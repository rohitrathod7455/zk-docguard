pragma circom 2.1.6;

include "poseidon.circom";

/**
 * @title CredentialTree
 * @notice Constructs an 8-leaf, depth-3 Poseidon binary Merkle tree root.
 *         Pairs adjacent nodes level-by-level matching packages/core/src/crypto/tree.ts:
 *           Layer 1 (4 nodes): Poseidon(leaves[2i], leaves[2i+1])
 *           Layer 2 (2 nodes): Poseidon(layer1[2j], layer1[2j+1])
 *           Layer 3 (1 node):  Poseidon(layer2[0], layer2[1]) -> root
 */
template CredentialTree() {
    signal input leaves[8];
    signal output root;

    // Layer 1: 4 nodes
    component layer1[4];
    for (var i = 0; i < 4; i++) {
        layer1[i] = Poseidon(2);
        layer1[i].inputs[0] <== leaves[i * 2];
        layer1[i].inputs[1] <== leaves[i * 2 + 1];
    }

    // Layer 2: 2 nodes
    component layer2[2];
    for (var j = 0; j < 2; j++) {
        layer2[j] = Poseidon(2);
        layer2[j].inputs[0] <== layer1[j * 2].out;
        layer2[j].inputs[1] <== layer1[j * 2 + 1].out;
    }

    // Layer 3: Root
    component rootHasher = Poseidon(2);
    rootHasher.inputs[0] <== layer2[0].out;
    rootHasher.inputs[1] <== layer2[1].out;

    root <== rootHasher.out;
}
