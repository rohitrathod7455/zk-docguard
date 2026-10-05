// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIssuerRegistry
 * @notice Interface for the IssuerRegistry contract managing institutional credential issuers.
 */
interface IIssuerRegistry {
    enum Status {
        None,
        Pending,
        Active,
        Suspended,
        Revoked
    }

    struct Issuer {
        string did;
        bytes32 zkKeyHash;
        string metadataURI;
        Status status;
        uint64 registeredAt;
        uint32 keyEpoch;
    }

    struct KeyRecord {
        address issuer;
        uint32 epoch;
        uint64 validUntil;
        bool isCurrent;
    }

    event IssuerApplied(
        address indexed issuer,
        string did,
        bytes32 zkKeyHash,
        string metadataURI
    );

    event IssuerApproved(address indexed issuer);
    event IssuerSuspended(address indexed issuer);
    event IssuerReinstated(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    event KeyRotated(
        address indexed issuer,
        bytes32 indexed oldKeyHash,
        bytes32 indexed newKeyHash,
        uint32 newEpoch,
        uint64 graceUntil
    );

    event GracePeriodUpdated(uint64 oldPeriod, uint64 newPeriod);

    function applyAsIssuer(
        string calldata did,
        bytes32 zkKeyHash,
        string calldata metadataURI
    ) external;

    function approveIssuer(address issuer) external;
    function suspendIssuer(address issuer) external;
    function reinstateIssuer(address issuer) external;
    function revokeIssuer(address issuer) external;

    function rotateKey(bytes32 newZkKeyHash) external;
    function setGracePeriod(uint64 newGracePeriod) external;

    function isActiveKey(bytes32 zkKeyHash) external view returns (bool);
    function issuerOfKey(bytes32 zkKeyHash) external view returns (address);
    function getIssuer(address issuer) external view returns (Issuer memory);
    function getIssuerStatus(address issuer) external view returns (Status);
    function getKeyRecord(bytes32 zkKeyHash) external view returns (KeyRecord memory);
}
