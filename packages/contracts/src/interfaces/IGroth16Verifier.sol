// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IGroth16Verifier
 * @notice Standard interface for snarkjs-exported Groth16 Solidity verifiers.
 */
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[26] calldata input
    ) external view returns (bool);
}
