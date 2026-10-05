// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDocumentRegistry
 * @notice Interface for DocumentRegistry anchoring document hashes, CIDs, and batch Merkle roots.
 */
interface IDocumentRegistry {
    enum DocumentStatus {
        Unknown,
        Valid,
        Expired,
        Revoked,
        IssuerSuspended
    }

    struct Record {
        address issuer;
        bytes32 credentialId;
        bytes32 schemaId;
        string cid;
        uint64 issuedAt;
        uint64 expiry;
        bool revoked;
    }

    struct BatchRecord {
        address issuer;
        bytes32 batchRoot;
        uint32 count;
        string manifestCid;
        uint64 anchoredAt;
    }

    event DocumentRegistered(
        bytes32 indexed docHash,
        address indexed issuer,
        bytes32 indexed credentialId,
        bytes32 schemaId,
        string cid,
        uint64 expiry
    );

    event BatchRegistered(
        bytes32 indexed batchRoot,
        address indexed issuer,
        uint32 count,
        string manifestCid
    );

    event DocumentRevoked(
        bytes32 indexed docHash,
        address indexed issuer,
        bytes32 reasonCode
    );

    function registerDocument(
        bytes32 docHash,
        bytes32 credentialId,
        bytes32 schemaId,
        string calldata cid,
        uint64 expiry
    ) external;

    function registerBatch(
        bytes32 batchRoot,
        uint32 count,
        string calldata manifestCid
    ) external;

    function revokeDocument(bytes32 docHash, bytes32 reasonCode) external;

    function verifyDocument(bytes32 docHash)
        external
        view
        returns (
            DocumentStatus status,
            address issuer,
            uint64 issuedAt,
            uint64 expiry
        );

    function verifyInBatch(
        bytes32 batchRoot,
        bytes32 docHash,
        bytes32[] calldata proof
    ) external view returns (bool);

    function getDocument(bytes32 docHash) external view returns (Record memory);
    function getBatch(bytes32 batchRoot) external view returns (BatchRecord memory);
}
