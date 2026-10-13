// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IVerifierGateway} from "./interfaces/IVerifierGateway.sol";
import {IIssuerRegistry} from "./interfaces/IIssuerRegistry.sol";
import {IRevocationRegistry} from "./interfaces/IRevocationRegistry.sol";
import {IGroth16Verifier} from "./interfaces/IGroth16Verifier.sol";

/**
 * @title VerifierGateway
 * @notice Enterprise Zero-Knowledge presentation verification gateway.
 *         Verifies Groth16 proofs, active institutional issuer keys, timestamp bounds,
 *         and revocation validity (Mode A direct flag or Mode B SMT in-circuit non-revocation).
 *         Supports both view simulation and on-chain replay-resistant challenge consumption.
 */
contract VerifierGateway is IVerifierGateway, AccessControl, Pausable {
    uint64 public constant TIMESTAMP_TOLERANCE = 300; // ±5 minutes (300 seconds)

    IIssuerRegistry public immutable ISSUER_REGISTRY;
    IRevocationRegistry public immutable REVOCATION_REGISTRY;
    IGroth16Verifier public immutable VERIFIER_MODE_A;
    IGroth16Verifier public immutable VERIFIER_MODE_B;

    // Challenge nonces consumed to prevent on-chain replay attacks
    mapping(bytes32 => bool) private _consumedChallenges;

    // Custom errors
    error InvalidParameters();
    error ChallengeAlreadyConsumed(bytes32 challengeNonce);
    error VerificationFailed(VerificationFailureReason reason);

    /**
     * @notice Initializes the VerifierGateway with registry and circuit verifier contracts.
     * @param admin Address granted DEFAULT_ADMIN_ROLE.
     * @param issuerRegistryAddress Address of IssuerRegistry.
     * @param revocationRegistryAddress Address of RevocationRegistry.
     * @param verifierModeAAddress Address of Groth16Verifier (Mode A).
     * @param verifierModeBAddress Address of Groth16VerifierModeB (Mode B).
     */
    constructor(
        address admin,
        address issuerRegistryAddress,
        address revocationRegistryAddress,
        address verifierModeAAddress,
        address verifierModeBAddress
    ) {
        if (
            admin == address(0) ||
            issuerRegistryAddress == address(0) ||
            revocationRegistryAddress == address(0) ||
            verifierModeAAddress == address(0) ||
            verifierModeBAddress == address(0)
        ) {
            revert InvalidParameters();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        ISSUER_REGISTRY = IIssuerRegistry(issuerRegistryAddress);
        REVOCATION_REGISTRY = IRevocationRegistry(revocationRegistryAddress);
        VERIFIER_MODE_A = IGroth16Verifier(verifierModeAAddress);
        VERIFIER_MODE_B = IGroth16Verifier(verifierModeBAddress);
    }

    /**
     * @notice View function to verify a Groth16 presentation proof and all constraints.
     * @param a Groth16 pi_a coordinates.
     * @param b Groth16 pi_b coordinates.
     * @param c Groth16 pi_c coordinates.
     * @param pubSignals 26 public signals.
     * @param mode Mode A (direct revocation check) or Mode B (in-circuit SMT non-membership).
     * @return ok True if presentation and all checks are strictly valid.
     * @return reason Failure reason code (None = 0 if valid).
     */
    function verifyPresentation(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[26] calldata pubSignals,
        VerificationMode mode
    ) public view whenNotPaused returns (bool ok, VerificationFailureReason reason) {
        bytes32 issuerKeyHash;
        uint256 currentTime;

        if (mode == VerificationMode.ModeA_DirectRevocation) {
            // Mode A Signal Layout:
            // pubSignals[0]: credentialId
            // pubSignals[1]: issuerKeyHash
            // pubSignals[24]: currentTime
            // pubSignals[25]: challenge
            bytes32 credentialId = bytes32(pubSignals[0]);
            issuerKeyHash = bytes32(pubSignals[1]);
            currentTime = pubSignals[24];

            // 1. Verify Groth16 proof using Mode A verifier
            if (!VERIFIER_MODE_A.verifyProof(a, b, c, pubSignals)) {
                return (false, VerificationFailureReason.ProofInvalid);
            }

            // 2. Check revocation in RevocationRegistry
            if (REVOCATION_REGISTRY.isRevoked(credentialId)) {
                return (false, VerificationFailureReason.CredentialRevoked);
            }
        } else {
            // Mode B Signal Layout:
            // pubSignals[0]: issuerKeyHash
            // pubSignals[23]: currentTime
            // pubSignals[24]: challenge
            // pubSignals[25]: revocationRoot
            issuerKeyHash = bytes32(pubSignals[0]);
            currentTime = pubSignals[23];
            bytes32 revocationRoot = bytes32(pubSignals[25]);

            // 1. Verify Groth16 proof using Mode B verifier
            if (!VERIFIER_MODE_B.verifyProof(a, b, c, pubSignals)) {
                return (false, VerificationFailureReason.ProofInvalid);
            }

            // 2. Check that the SMT root is valid in RevocationRegistry ring buffer
            if (!REVOCATION_REGISTRY.isValidRoot(issuerKeyHash, revocationRoot)) {
                return (false, VerificationFailureReason.RevocationRootInvalid);
            }
        }

        // 3. Verify that the issuer's key is active in IssuerRegistry
        if (!ISSUER_REGISTRY.isActiveKey(issuerKeyHash)) {
            return (false, VerificationFailureReason.IssuerKeyInactive);
        }

        // 4. Verify that currentTime is within ±5 minutes of block.timestamp
        uint64 blockTime = uint64(block.timestamp);
        if (
            currentTime > blockTime + TIMESTAMP_TOLERANCE ||
            currentTime + TIMESTAMP_TOLERANCE < blockTime
        ) {
            return (false, VerificationFailureReason.TimestampExpired);
        }

        return (true, VerificationFailureReason.None);
    }

    /**
     * @notice State-modifying function that verifies presentation and consumes the challenge nonce
     *         to prevent on-chain replay attacks and record verification on-chain.
     */
    function consumeAndVerify(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[26] calldata pubSignals,
        VerificationMode mode,
        bytes32 challengeNonce
    ) external whenNotPaused returns (bool ok, VerificationFailureReason reason) {
        if (challengeNonce == bytes32(0)) revert InvalidParameters();
        if (_consumedChallenges[challengeNonce]) {
            revert ChallengeAlreadyConsumed(challengeNonce);
        }

        (bool valid, VerificationFailureReason failReason) = verifyPresentation(
            a,
            b,
            c,
            pubSignals,
            mode
        );

        if (!valid) {
            revert VerificationFailed(failReason);
        }

        _consumedChallenges[challengeNonce] = true;

        bytes32 issuerKeyHash = mode == VerificationMode.ModeA_DirectRevocation
            ? bytes32(pubSignals[1])
            : bytes32(pubSignals[0]);

        emit PresentationVerified(
            challengeNonce,
            issuerKeyHash,
            mode,
            msg.sender,
            uint64(block.timestamp)
        );

        return (true, VerificationFailureReason.None);
    }

    /**
     * @notice Checks whether a challenge nonce has already been consumed.
     */
    function isChallengeConsumed(bytes32 challengeNonce) external view returns (bool) {
        return _consumedChallenges[challengeNonce];
    }

    /**
     * @notice Pauses contract functions in an emergency.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses contract functions.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
