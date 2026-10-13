pragma circom 2.1.6;

include "./templates/disclose_mode_b.circom";

component main {public [issuerKeyHash, revealMask, revealedValues, predEnable, predIndex, predThreshold, currentTime, challenge, revocationRoot]} = DiscloseModeB(8, 2, 10);
