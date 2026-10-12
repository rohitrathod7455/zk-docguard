pragma circom 2.1.6;

include "poseidon.circom";

/**
 * @title HolderBinding
 * @notice Enforces that slot 0 of the credential matches the prover's private secret:
 *         holderCommitment === Poseidon(holderSecret)
 */
template HolderBinding() {
    signal input holderSecret;
    signal input holderCommitment;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== holderSecret;
    hasher.out === holderCommitment;
}
