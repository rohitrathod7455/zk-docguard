pragma circom 2.1.6;

/**
 * @title Disclosure
 * @notice Enforces selective attribute disclosure constraints:
 *         1. revealMask[i] in {0, 1}
 *         2. When revealMask[i] == 1: revealedValues[i] === values[i]
 *         3. When revealMask[i] == 0: revealedValues[i] === 0
 * @param N Number of attribute slots
 */
template Disclosure(N) {
    signal input values[N];
    signal input revealMask[N];
    signal input revealedValues[N];

    for (var i = 0; i < N; i++) {
        // Enforce boolean revealMask
        revealMask[i] * (revealMask[i] - 1) === 0;

        // If revealed (mask = 1), values[i] must equal revealedValues[i]
        revealMask[i] * (values[i] - revealedValues[i]) === 0;

        // If hidden (mask = 0), revealedValues[i] must be zero
        (1 - revealMask[i]) * revealedValues[i] === 0;
    }
}
