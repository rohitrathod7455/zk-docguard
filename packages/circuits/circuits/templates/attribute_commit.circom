pragma circom 2.1.6;

include "poseidon.circom";

/**
 * @title AttributeCommit
 * @notice Computes salted leaf commitments for N attribute slots:
 *         leaves[i] = Poseidon(values[i], salts[i])
 * @param N Number of attribute slots
 */
template AttributeCommit(N) {
    signal input values[N];
    signal input salts[N];
    signal output leaves[N];

    component hashers[N];
    for (var i = 0; i < N; i++) {
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== values[i];
        hashers[i].inputs[1] <== salts[i];
        leaves[i] <== hashers[i].out;
    }
}
