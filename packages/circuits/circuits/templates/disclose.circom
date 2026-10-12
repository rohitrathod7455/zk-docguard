pragma circom 2.1.6;

include "poseidon.circom";
include "eddsaposeidon.circom";
include "comparators.circom";
include "bitify.circom";
include "attribute_commit.circom";
include "credential_tree.circom";
include "holder_binding.circom";
include "disclosure.circom";
include "predicate.circom";

/**
 * @title DiscloseModeA
 * @notice Selective disclosure zero-knowledge credential verification circuit (Mode A).
 *         Verifies an authenticated credential issued by an active institutional issuer,
 *         validates selective disclosure of attributes, range predicates, expiration,
 *         and prover identity binding without leaking hidden claims.
 * @param N Number of attribute slots (8)
 * @param P Number of range predicates (2)
 */
template DiscloseModeA(N, P) {
    // ---------------------------------------------------------
    // Private Inputs
    // ---------------------------------------------------------
    signal input values[N];
    signal input salts[N];
    signal input holderSecret;

    // Issuer BabyJubJub EdDSA public key and signature
    signal input Ax;
    signal input Ay;
    signal input R8x;
    signal input R8y;
    signal input S;

    // ---------------------------------------------------------
    // Public Inputs
    // ---------------------------------------------------------
    signal input issuerKeyHash;
    signal input revealMask[N];
    signal input revealedValues[N];

    signal input predEnable[P];
    signal input predIndex[P];
    signal input predThreshold[P];

    signal input currentTime;
    signal input challenge;

    // ---------------------------------------------------------
    // Public Outputs
    // ---------------------------------------------------------
    signal output credentialId;

    // ---------------------------------------------------------
    // 1. Attribute Commitments: leaf[i] = Poseidon(value[i], salt[i])
    // ---------------------------------------------------------
    component commit = AttributeCommit(N);
    for (var i = 0; i < N; i++) {
        commit.values[i] <== values[i];
        commit.salts[i] <== salts[i];
    }

    // ---------------------------------------------------------
    // 2. Binary Merkle Tree: credentialRoot over 8 leaves
    // ---------------------------------------------------------
    component credTree = CredentialTree();
    for (var j = 0; j < 8; j++) {
        credTree.leaves[j] <== commit.leaves[j];
    }
    signal credentialRoot;
    credentialRoot <== credTree.root;

    // ---------------------------------------------------------
    // 3. Issuer BabyJubJub Key Hash Anchoring: Poseidon(Ax, Ay) === issuerKeyHash
    // ---------------------------------------------------------
    component keyHasher = Poseidon(2);
    keyHasher.inputs[0] <== Ax;
    keyHasher.inputs[1] <== Ay;
    keyHasher.out === issuerKeyHash;

    // ---------------------------------------------------------
    // 4. EdDSA Signature Verification: Issuer signed credentialRoot
    // ---------------------------------------------------------
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== Ax;
    sigVerifier.Ay <== Ay;
    sigVerifier.R8x <== R8x;
    sigVerifier.R8y <== R8y;
    sigVerifier.S <== S;
    sigVerifier.M <== credentialRoot;

    // ---------------------------------------------------------
    // 5. Holder Secret Binding: values[0] === Poseidon(holderSecret)
    // ---------------------------------------------------------
    component holderBinding = HolderBinding();
    holderBinding.holderSecret <== holderSecret;
    holderBinding.holderCommitment <== values[0];

    // ---------------------------------------------------------
    // 6. Selective Disclosure Constraints
    // ---------------------------------------------------------
    component disclosure = Disclosure(N);
    for (var k = 0; k < N; k++) {
        disclosure.values[k] <== values[k];
        disclosure.revealMask[k] <== revealMask[k];
        disclosure.revealedValues[k] <== revealedValues[k];
    }

    // ---------------------------------------------------------
    // 7. Inequality Predicates (values[predIndex[p]] >= predThreshold[p])
    // ---------------------------------------------------------
    component predicates = Predicate(N, P, 64);
    for (var m = 0; m < N; m++) {
        predicates.values[m] <== values[m];
    }
    for (var p = 0; p < P; p++) {
        predicates.predEnable[p] <== predEnable[p];
        predicates.predIndex[p] <== predIndex[p];
        predicates.predThreshold[p] <== predThreshold[p];
    }

    // ---------------------------------------------------------
    // 8. Expiration Verification (values[7] >= currentTime if values[7] > 0)
    // ---------------------------------------------------------
    component expZero = IsZero();
    expZero.in <== values[7];

    component curTimeBits = Num2Bits(64);
    curTimeBits.in <== currentTime;

    component expBits = Num2Bits(64);
    expBits.in <== values[7];

    component expGe = GreaterEqThan(64);
    expGe.in[0] <== values[7];
    expGe.in[1] <== currentTime;

    // Expiry check satisfied if values[7] == 0 (no expiry) OR values[7] >= currentTime
    (1 - expZero.out) * (1 - expGe.out) === 0;

    // ---------------------------------------------------------
    // 9. Challenge Binding: dummy constraint prevents optimizer pruning
    // ---------------------------------------------------------
    signal challengeSquare;
    challengeSquare <== challenge * challenge;

    // ---------------------------------------------------------
    // 10. Public Credential ID: credentialId = Poseidon(credentialRoot, 1)
    // ---------------------------------------------------------
    component credIdHasher = Poseidon(2);
    credIdHasher.inputs[0] <== credentialRoot;
    credIdHasher.inputs[1] <== 1;
    credentialId <== credIdHasher.out;
}
