pragma circom 2.1.6;

include "comparators.circom";
include "multiplexer.circom";
include "bitify.circom";

/**
 * @title Predicate
 * @notice Verifies P inequality predicates over N attributes:
 *         values[predIndex[p]] >= predThreshold[p] (when predEnable[p] == 1)
 * @param N Number of attribute slots (8)
 * @param P Number of predicate slots (2)
 * @param BITS Bit width of numeric comparisons (64)
 */
template Predicate(N, P, BITS) {
    signal input values[N];
    signal input predEnable[P];
    signal input predIndex[P];
    signal input predThreshold[P];

    component mux[P];
    component ge[P];
    component rangeVal[P];
    component rangeThresh[P];

    signal effectiveVal[P];
    signal effectiveThresh[P];

    for (var p = 0; p < P; p++) {
        // 1. predEnable must be boolean
        predEnable[p] * (predEnable[p] - 1) === 0;

        // 2. Select values[predIndex[p]] using Multiplexer (Decoder enforces predIndex in [0, N-1])
        mux[p] = Multiplexer(1, N);
        for (var j = 0; j < N; j++) {
            mux[p].inp[j][0] <== values[j];
        }
        mux[p].sel <== predIndex[p];

        // 3. Mask operand values with predEnable so non-enabled predicates do not exceed BITS
        effectiveVal[p] <== predEnable[p] * mux[p].out[0];
        effectiveThresh[p] <== predEnable[p] * predThreshold[p];

        // 4. Bit-range check operands to prevent field wrap-around
        rangeVal[p] = Num2Bits(BITS);
        rangeVal[p].in <== effectiveVal[p];

        rangeThresh[p] = Num2Bits(BITS);
        rangeThresh[p].in <== effectiveThresh[p];

        // 5. Compare effectiveVal >= effectiveThresh
        ge[p] = GreaterEqThan(BITS);
        ge[p].in[0] <== effectiveVal[p];
        ge[p].in[1] <== effectiveThresh[p];

        // 6. Enforce inequality when enabled: predEnable[p] * (1 - ge.out) === 0
        predEnable[p] * (1 - ge[p].out) === 0;
    }
}
