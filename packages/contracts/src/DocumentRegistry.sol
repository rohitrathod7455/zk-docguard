// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IDocumentRegistry} from "./interfaces/IDocumentRegistry.sol";
import {IIssuerRegistry} from "./interfaces/IIssuerRegistry.sol";

/**
 * @title DocumentRegistry
 * @notice Anchors encrypted document hashes (SHA-256), IPFS CIDs, and batch Merkle roots on-chain.
 *         Verifies document validity by checking revocation, expiry, and issuing institution status.
 */
contract DocumentRegistry is IDocumentRegistry, AccessControl, Pausable {
    IIssuerRegistry public immutable ISSUER_REGISTRY;

    mapping(bytes32 => Record) private _documents;
    mapping(bytes32 => BatchRecord) private _batches;

    // Custom errors
    error DocumentAlreadyRegistered(bytes32 docHash);
    error DocumentNotFound(bytes32 docHash);
    error BatchAlreadyRegistered(bytes32 batchRoot);
    error BatchNotFound(bytes32 batchRoot);
    error IssuerNotActive(address caller);
    error UnauthorizedIssuer(address caller, address actualIssuer);
    error DocumentAlreadyRevoked(bytes32 docHash);
    error InvalidExpiry(uint64 expiry);
    error InvalidParameters();

    /**
     * @notice Initializes the registry with the IssuerRegistry address and admin.
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
     * @notice Anchors an individual document record on-chain.
     * @param docHash SHA-256 hash of the plaintext document bytes.
     * @param credentialId Unique domain-separated identifier Poseidon(credentialRoot, 1).
     * @param schemaId Poseidon hash of canonical schema definition.
     * @param cid IPFS Content Identifier of the client-side encrypted ciphertext.
     * @param expiry UNIX timestamp after which the credential is no longer valid (0 for no expiry).
     */
    function registerDocument(
        bytes32 docHash,
        bytes32 credentialId,
        bytes32 schemaId,
        string calldata cid,
        uint64 expiry
    ) external whenNotPaused {
        if (ISSUER_REGISTRY.getIssuerStatus(msg.sender) != IIssuerRegistry.Status.Active) {
            revert IssuerNotActive(msg.sender);
        }
        if (docHash == bytes32(0) || credentialId == bytes32(0)) {
            revert InvalidParameters();
        }
        if (_documents[docHash].issuer != address(0)) {
            revert DocumentAlreadyRegistered(docHash);
        }
        if (expiry != 0 && expiry <= block.timestamp) {
            revert InvalidExpiry(expiry);
        }

        _documents[docHash] = Record({
            issuer: msg.sender,
            credentialId: credentialId,
            schemaId: schemaId,
            cid: cid,
            issuedAt: uint64(block.timestamp),
            expiry: expiry,
            revoked: false
        });

        emit DocumentRegistered(
            docHash,
            msg.sender,
            credentialId,
            schemaId,
            cid,
            expiry
        );
    }

    /**
     * @notice Anchors a Merkle root of multiple document hashes for bulk issuance.
     * @param batchRoot Merkle root of the batch.
     * @param count Number of documents represented by this root.
     * @param manifestCid IPFS CID containing the batch manifest / individual proof paths.
     */
    function registerBatch(
        bytes32 batchRoot,
        uint32 count,
        string calldata manifestCid
    ) external whenNotPaused {
        if (ISSUER_REGISTRY.getIssuerStatus(msg.sender) != IIssuerRegistry.Status.Active) {
            revert IssuerNotActive(msg.sender);
        }
        if (batchRoot == bytes32(0) || count == 0) {
            revert InvalidParameters();
        }
        if (_batches[batchRoot].issuer != address(0)) {
            revert BatchAlreadyRegistered(batchRoot);
        }

        _batches[batchRoot] = BatchRecord({
            issuer: msg.sender,
            batchRoot: batchRoot,
            count: count,
            manifestCid: manifestCid,
            anchoredAt: uint64(block.timestamp)
        });

        emit BatchRegistered(batchRoot, msg.sender, count, manifestCid);
    }

    /**
     * @notice Revokes a previously registered document.
     * @dev Only the original issuing institution can revoke.
     * @param docHash SHA-256 hash of the document to revoke.
     * @param reasonCode Cryptographic code or standardized enum indicating revocation reason.
     */
    function revokeDocument(bytes32 docHash, bytes32 reasonCode) external whenNotPaused {
        Record storage record = _documents[docHash];
        if (record.issuer == address(0)) {
            revert DocumentNotFound(docHash);
        }
        if (record.issuer != msg.sender) {
            revert UnauthorizedIssuer(msg.sender, record.issuer);
        }
        if (record.revoked) {
            revert DocumentAlreadyRevoked(docHash);
        }

        record.revoked = true;
        emit DocumentRevoked(docHash, msg.sender, reasonCode);
    }

    /**
     * @notice Performs full on-chain status verification of a document hash.
     * @param docHash SHA-256 hash of the document.
     * @return status Current status: Unknown, Valid, Expired, Revoked, or IssuerSuspended.
     * @return issuer Address of the issuing institution.
     * @return issuedAt UNIX timestamp when the document was registered.
     * @return expiry UNIX timestamp when the document expires (0 for permanent).
     */
    function verifyDocument(bytes32 docHash)
        external
        view
        returns (
            DocumentStatus status,
            address issuer,
            uint64 issuedAt,
            uint64 expiry
        )
    {
        Record memory record = _documents[docHash];
        if (record.issuer == address(0)) {
            return (DocumentStatus.Unknown, address(0), 0, 0);
        }

        if (record.revoked) {
            return (DocumentStatus.Revoked, record.issuer, record.issuedAt, record.expiry);
        }

        if (record.expiry != 0 && record.expiry <= block.timestamp) {
            return (DocumentStatus.Expired, record.issuer, record.issuedAt, record.expiry);
        }

        // Verify issuing institution is currently Active
        IIssuerRegistry.Status issuerStatus = ISSUER_REGISTRY.getIssuerStatus(record.issuer);
        if (issuerStatus != IIssuerRegistry.Status.Active) {
            return (DocumentStatus.IssuerSuspended, record.issuer, record.issuedAt, record.expiry);
        }

        return (DocumentStatus.Valid, record.issuer, record.issuedAt, record.expiry);
    }

    /**
     * @notice Verifies inclusion of a document hash within a registered batch Merkle root.
     * @param batchRoot The batch Merkle root anchored on-chain.
     * @param docHash The document hash (leaf in the Merkle tree).
     * @param proof Merkle inclusion proof.
     * @return bool True if the proof is valid and the issuing batch is registered by an active issuer.
     */
    function verifyInBatch(
        bytes32 batchRoot,
        bytes32 docHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        BatchRecord memory batch = _batches[batchRoot];
        if (batch.issuer == address(0)) return false;

        // Check if issuing institution is active
        if (ISSUER_REGISTRY.getIssuerStatus(batch.issuer) != IIssuerRegistry.Status.Active) {
            return false;
        }

        return MerkleProof.verify(proof, batchRoot, docHash);
    }

    /**
     * @notice Retrieves the raw document record.
     */
    function getDocument(bytes32 docHash) external view returns (Record memory) {
        return _documents[docHash];
    }

    /**
     * @notice Retrieves the raw batch record.
     */
    function getBatch(bytes32 batchRoot) external view returns (BatchRecord memory) {
        return _batches[batchRoot];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
