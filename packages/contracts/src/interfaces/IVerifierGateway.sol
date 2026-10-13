// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerifierGateway
 * @notice Interface for on-chain Zero-Knowledge presentation verification gateway.
 *         Supports both Mode A (direct on-chain revocation checking) and
 *         Mode B (privacy-preserving Sparse Merkle Tree non-revocation in-circuit).
 */
interface IVerifierGateway {
    enum VerificationMode {
        ModeA_DirectRevocation, // Mode 0: Public credentialId checked in RevocationRegistry
        ModeB_SmtNonRevocation  // Mode 1: In-circuit SMT non-membership proof
    }

    enum VerificationFailureReason {
        None,                  // 0: Success
        ProofInvalid,          // 1: Groth16 cryptographic proof check failed
        IssuerKeyInactive,     // 2: issuerKeyHash is not active in IssuerRegistry
        RevocationRootInvalid, // 3: revocationRoot not valid in RevocationRegistry ring buffer
        TimestampExpired,      // 4: currentTime is not within ±5 minutes of block.timestamp
        ChallengeReplayed,     // 5: challenge nonce already consumed
        CredentialRevoked      // 6: credentialId is revoked in RevocationRegistry
    }

    event PresentationVerified(
        bytes32 indexed challengeNonce,
        bytes32 indexed issuerKeyHash,
        VerificationMode mode,
        address indexed verifier,
        uint64 timestamp
    );

    /**
     * @notice View function to verify a Groth16 presentation proof and all constraints.
     */
    function verifyPresentation(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[26] calldata pubSignals,
        VerificationMode mode
    ) external view returns (bool ok, VerificationFailureReason reason);

    /**
     * @notice State-modifying function that verifies the presentation and consumes the challenge nonce
     *         to prevent replay attacks on-chain (and measure on-chain execution gas).
     */
    function consumeAndVerify(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[26] calldata pubSignals,
        VerificationMode mode,
        bytes32 challengeNonce
    ) external returns (bool ok, VerificationFailureReason reason);

    /**
     * @notice Checks whether a challenge nonce has already been consumed.
     */
    function isChallengeConsumed(bytes32 challengeNonce) external view returns (bool);
}
