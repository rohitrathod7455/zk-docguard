// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IIssuerRegistry} from "./interfaces/IIssuerRegistry.sol";

/**
 * @title IssuerRegistry
 * @notice Manages verified institutional credential issuers, their cryptographic public key hashes,
 *         status lifecycle, and key rotation with configurable grace periods.
 * @dev Conforms to OpenZeppelin v5 AccessControl and Pausable patterns.
 */
contract IssuerRegistry is IIssuerRegistry, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Default grace period for rotated keys: 7 days
    uint64 public constant DEFAULT_GRACE_PERIOD = 7 days;

    /// @notice Active grace period during which rotated keys remain valid for verification
    uint64 public keyGracePeriod;

    mapping(address => Issuer) private _issuers;
    mapping(bytes32 => KeyRecord) private _keyRecords;

    // Custom errors
    error IssuerAlreadyRegistered(address issuer);
    error InvalidParameters();
    error KeyAlreadyUsed(bytes32 keyHash);
    error InvalidIssuerStatus(address issuer, Status current, Status required);
    error IssuerNotActive(address issuer);
    error KeyNotFound(bytes32 keyHash);

    /**
     * @notice Initializes the registry with the deployer as default admin.
     * @param admin The address granted DEFAULT_ADMIN_ROLE.
     */
    constructor(address admin) {
        if (admin == address(0)) revert InvalidParameters();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        keyGracePeriod = DEFAULT_GRACE_PERIOD;
    }

    /**
     * @notice Allows an institution to apply for issuer status.
     * @param did The decentralized identifier of the institution (e.g. did:ethr:0x...).
     * @param zkKeyHash Poseidon hash of the issuer's BabyJubJub public key (Poseidon(Ax, Ay)).
     * @param metadataURI Off-chain metadata URI (e.g. IPFS CID or HTTPS URL) describing the institution.
     */
    function applyAsIssuer(
        string calldata did,
        bytes32 zkKeyHash,
        string calldata metadataURI
    ) external whenNotPaused {
        if (bytes(did).length == 0 || zkKeyHash == bytes32(0)) {
            revert InvalidParameters();
        }
        if (_issuers[msg.sender].status != Status.None) {
            revert IssuerAlreadyRegistered(msg.sender);
        }
        if (_keyRecords[zkKeyHash].issuer != address(0)) {
            revert KeyAlreadyUsed(zkKeyHash);
        }

        _issuers[msg.sender] = Issuer({
            did: did,
            zkKeyHash: zkKeyHash,
            metadataURI: metadataURI,
            status: Status.Pending,
            registeredAt: uint64(block.timestamp),
            keyEpoch: 1
        });

        _keyRecords[zkKeyHash] = KeyRecord({
            issuer: msg.sender,
            epoch: 1,
            validUntil: 0,
            isCurrent: true
        });

        emit IssuerApplied(msg.sender, did, zkKeyHash, metadataURI);
    }

    /**
     * @notice Approves a pending issuer.
     * @param issuer Address of the institution to approve.
     */
    function approveIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Status current = _issuers[issuer].status;
        if (current != Status.Pending) {
            revert InvalidIssuerStatus(issuer, current, Status.Pending);
        }

        _issuers[issuer].status = Status.Active;
        emit IssuerApproved(issuer);
    }

    /**
     * @notice Suspends an active issuer, temporarily invalidating its credentials and issuance ability.
     * @param issuer Address of the institution to suspend.
     */
    function suspendIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Status current = _issuers[issuer].status;
        if (current != Status.Active) {
            revert InvalidIssuerStatus(issuer, current, Status.Active);
        }

        _issuers[issuer].status = Status.Suspended;
        emit IssuerSuspended(issuer);
    }

    /**
     * @notice Reinstates a suspended issuer to active status.
     * @param issuer Address of the institution to reinstate.
     */
    function reinstateIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Status current = _issuers[issuer].status;
        if (current != Status.Suspended) {
            revert InvalidIssuerStatus(issuer, current, Status.Suspended);
        }

        _issuers[issuer].status = Status.Active;
        emit IssuerReinstated(issuer);
    }

    /**
     * @notice Permanently revokes an issuer and invalidates its proving keys.
     * @param issuer Address of the institution to revoke.
     */
    function revokeIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Status current = _issuers[issuer].status;
        if (current == Status.None || current == Status.Revoked) {
            revert InvalidIssuerStatus(issuer, current, Status.Active);
        }

        _issuers[issuer].status = Status.Revoked;

        // Invalidate current key
        bytes32 currentKey = _issuers[issuer].zkKeyHash;
        if (currentKey != bytes32(0)) {
            _keyRecords[currentKey].isCurrent = false;
            _keyRecords[currentKey].validUntil = uint64(block.timestamp);
        }

        emit IssuerRevoked(issuer);
    }

    /**
     * @notice Rotates the active ZK proving key for the caller.
     * @dev The previous key remains valid for the duration of `keyGracePeriod`.
     * @param newZkKeyHash Poseidon hash of the new BabyJubJub key.
     */
    function rotateKey(bytes32 newZkKeyHash) external whenNotPaused {
        if (_issuers[msg.sender].status != Status.Active) {
            revert IssuerNotActive(msg.sender);
        }
        if (newZkKeyHash == bytes32(0)) revert InvalidParameters();
        if (_keyRecords[newZkKeyHash].issuer != address(0)) {
            revert KeyAlreadyUsed(newZkKeyHash);
        }

        bytes32 oldKey = _issuers[msg.sender].zkKeyHash;
        uint64 graceUntil = uint64(block.timestamp + keyGracePeriod);

        // Deprecate old key with grace period
        _keyRecords[oldKey].isCurrent = false;
        _keyRecords[oldKey].validUntil = graceUntil;

        // Register new key
        uint32 newEpoch = _issuers[msg.sender].keyEpoch + 1;
        _keyRecords[newZkKeyHash] = KeyRecord({
            issuer: msg.sender,
            epoch: newEpoch,
            validUntil: 0,
            isCurrent: true
        });

        _issuers[msg.sender].zkKeyHash = newZkKeyHash;
        _issuers[msg.sender].keyEpoch = newEpoch;

        emit KeyRotated(msg.sender, oldKey, newZkKeyHash, newEpoch, graceUntil);
    }

    /**
     * @notice Sets the grace period window for rotated keys.
     * @param newGracePeriod Period in seconds.
     */
    function setGracePeriod(uint64 newGracePeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint64 old = keyGracePeriod;
        keyGracePeriod = newGracePeriod;
        emit GracePeriodUpdated(old, newGracePeriod);
    }

    /**
     * @notice Checks if a ZK key hash is currently valid (active or within grace window).
     * @param zkKeyHash The key hash to verify.
     * @return bool True if key belongs to an active issuer and is current or within grace window.
     */
    function isActiveKey(bytes32 zkKeyHash) external view returns (bool) {
        KeyRecord memory record = _keyRecords[zkKeyHash];
        if (record.issuer == address(0)) return false;

        // Issuer must be currently Active
        if (_issuers[record.issuer].status != Status.Active) return false;

        // Current key is active
        if (record.isCurrent) return true;

        // Retired key is active if within grace period
        return block.timestamp <= record.validUntil;
    }

    /**
     * @notice Returns the issuing institution associated with a key hash.
     */
    function issuerOfKey(bytes32 zkKeyHash) external view returns (address) {
        return _keyRecords[zkKeyHash].issuer;
    }

    /**
     * @notice Returns the full issuer record.
     */
    function getIssuer(address issuer) external view returns (Issuer memory) {
        return _issuers[issuer];
    }

    /**
     * @notice Returns the current status of an issuer.
     */
    function getIssuerStatus(address issuer) external view returns (Status) {
        return _issuers[issuer].status;
    }

    /**
     * @notice Returns the key record details for a specific key hash.
     */
    function getKeyRecord(bytes32 zkKeyHash) external view returns (KeyRecord memory) {
        return _keyRecords[zkKeyHash];
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
