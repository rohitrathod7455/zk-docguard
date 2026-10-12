pragma circom 2.1.6;

include "./templates/disclose.circom";

component main {public [issuerKeyHash, revealMask, revealedValues, predEnable, predIndex, predThreshold, currentTime, challenge]} = DiscloseModeA(8, 2);
