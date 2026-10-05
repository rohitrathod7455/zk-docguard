// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IRevocationRegistry} from "./interfaces/IRevocationRegistry.sol";
import {IIssuerRegistry} from "./interfaces/IIssuerRegistry.sol";

/**
 * @title RevocationRegistry
 * @notice Supports both simple on-chain credentialId revocation flags (v1)
 *         and privacy-preserving Sparse Merkle Tree (SMT) per-issuer root history ring buffers (v2).
 */
contract RevocationRegistry is IRevocationRegistry, AccessControl, Pausable {
    uint8 public constant ROOT_HISTORY_SIZE = 32;

    IIssuerRegistry public immutable ISSUER_REGISTRY;

    // v1: Direct credential revocation mapping
    mapping(bytes32 => bool) private _revokedCredentials;
    mapping(bytes32 => address) private _revocationIssuer;

    // v2: Per-issuer SMT root history ring buffer (last 32 roots)
    struct RootHistory {
        bytes32[32] roots;
        uint32 currentEpoch;
        uint8 writeIndex;
    }

    mapping(bytes32 => RootHistory) private _rootHistories;

    // Custom errors
    error CredentialAlreadyRevoked(bytes32 credentialId);
    error IssuerNotActive(address caller);
    error UnauthorizedIssuer(address caller, bytes32 issuerKeyHash);
    error InvalidParameters();

    /**
     * @notice Initializes the RevocationRegistry with the IssuerRegistry address and admin.
     * @param admin The address granted DEFAULT_ADMIN_ROLE.
     * @param issuerRegistryAddress Address of the deployed IssuerRegistry contract.
     */
    constructor(address admin, address issuerRegistryAddress) {
        if (admin == address(0) || issuerRegistryAddress == address(0)) {
            revert InvalidParameters();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        ISSUER_REGISTRY = IIssuerRegistry(issuerRegistryAddress);
    }

    /**
     * @notice Revokes a credential by its unique credential identifier.
     * @dev Caller must be an active registered issuer.
     * @param credentialId Poseidon(credentialRoot, 1) domain-separated identifier.
     */
    function revokeCredential(bytes32 credentialId) external whenNotPaused {
        if (ISSUER_REGISTRY.getIssuerStatus(msg.sender) != IIssuerRegistry.Status.Active) {
            revert IssuerNotActive(msg.sender);
        }
        if (credentialId == bytes32(0)) revert InvalidParameters();
        if (_revokedCredentials[credentialId]) {
            revert CredentialAlreadyRevoked(credentialId);
        }

        _revokedCredentials[credentialId] = true;
        _revocationIssuer[credentialId] = msg.sender;

        emit CredentialRevoked(credentialId, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Checks if a credential has been revoked on-chain.
     * @param credentialId Unique credential identifier.
     * @return bool True if revoked.
     */
    function isRevoked(bytes32 credentialId) external view returns (bool) {
        return _revokedCredentials[credentialId];
    }

    /**
     * @notice Returns the issuer that revoked a credential.
     */
    function revocationIssuer(bytes32 credentialId) external view returns (address) {
        return _revocationIssuer[credentialId];
    }

    /**
     * @notice Updates the SMT revocation root for an issuer.
     * @dev Only the active issuer owning `issuerKeyHash` can update its root.
     *      Appends to a 32-element ring buffer so valid proofs referencing recent roots succeed.
     * @param issuerKeyHash Poseidon(Ax, Ay) of the issuer's BabyJubJub key.
     * @param newRoot The new 256-bit Sparse Merkle Tree root.
     */
    function updateRevocationRoot(bytes32 issuerKeyHash, bytes32 newRoot) external whenNotPaused {
        if (newRoot == bytes32(0) || issuerKeyHash == bytes32(0)) {
            revert InvalidParameters();
        }

        address owner = ISSUER_REGISTRY.issuerOfKey(issuerKeyHash);
        if (owner != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedIssuer(msg.sender, issuerKeyHash);
        }
        if (ISSUER_REGISTRY.getIssuerStatus(owner) != IIssuerRegistry.Status.Active) {
            revert IssuerNotActive(owner);
        }

        RootHistory storage history = _rootHistories[issuerKeyHash];
        history.roots[history.writeIndex] = newRoot;
        history.writeIndex = (history.writeIndex + 1) % ROOT_HISTORY_SIZE;
        history.currentEpoch += 1;

        emit RevocationRootUpdated(issuerKeyHash, newRoot, history.currentEpoch);
    }

    /**
     * @notice Verifies if a given root is currently valid (exists in the last 32 roots).
     * @param issuerKeyHash The issuer's BabyJubJub key hash.
     * @param root The root to verify.
     * @return bool True if the root exists in the ring buffer.
     */
    function isValidRoot(bytes32 issuerKeyHash, bytes32 root) external view returns (bool) {
        if (root == bytes32(0)) return false;

        RootHistory storage history = _rootHistories[issuerKeyHash];
        for (uint8 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (history.roots[i] == root) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Gets the latest SMT root and epoch for an issuer.
     */
    function getLatestRoot(bytes32 issuerKeyHash)
        external
        view
        returns (bytes32 root, uint32 epoch)
    {
        RootHistory storage history = _rootHistories[issuerKeyHash];
        if (history.currentEpoch == 0) {
            return (bytes32(0), 0);
        }
        uint8 latestIdx = (history.writeIndex + ROOT_HISTORY_SIZE - 1) % ROOT_HISTORY_SIZE;
        return (history.roots[latestIdx], history.currentEpoch);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
