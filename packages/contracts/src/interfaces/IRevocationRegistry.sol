// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRevocationRegistry
 * @notice Interface for credential revocation registry supporting both direct on-chain revocation (v1)
 *         and privacy-preserving Sparse Merkle Tree (SMT) root tracking (v2).
 */
interface IRevocationRegistry {
    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed issuer,
        uint64 timestamp
    );

    event RevocationRootUpdated(
        bytes32 indexed issuerKeyHash,
        bytes32 indexed root,
        uint32 epoch
    );

    function revokeCredential(bytes32 credentialId) external;
    function isRevoked(bytes32 credentialId) external view returns (bool);

    function updateRevocationRoot(bytes32 issuerKeyHash, bytes32 newRoot) external;
    function isValidRoot(bytes32 issuerKeyHash, bytes32 root) external view returns (bool);
    function getLatestRoot(bytes32 issuerKeyHash) external view returns (bytes32 root, uint32 epoch);
}
