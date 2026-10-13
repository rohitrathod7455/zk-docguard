import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// @ts-expect-error snarkjs untyped import
import * as snarkjs from 'snarkjs';
import { createSparseMerkleTree } from '@zk-docguard/core';
import { prisma } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Groth16ProofPayload {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface PresentationSubmission {
  proof: Groth16ProofPayload;
  publicSignals: string[];
  mode?: 'MODE_A' | 'MODE_B';
}

export interface VerificationReceipt {
  sessionId: string;
  verifierName: string;
  domain: string;
  verifiedAt: string;
  credentialId: string;
  issuerKeyHash: string;
  disclosedAttributes: Record<number, string>;
  satisfiedPredicates: Array<{ index: number; threshold: string }>;
  receiptSignature: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-key-zk-docguard-minimum-32-chars!!';
const TOLERANCE_WINDOW_SECONDS = 5 * 60; // ±5 minutes

let cachedVKeyModeA: Record<string, unknown> | null = null;
let cachedVKeyModeB: Record<string, unknown> | null = null;

function getVerificationKey(mode: 'MODE_A' | 'MODE_B' = 'MODE_A'): Record<string, unknown> {
  if (mode === 'MODE_B') {
    if (!cachedVKeyModeB) {
      const candidates = [
        path.resolve(__dirname, '../../../../packages/circuits/build/verification_key_mode_b.json'),
        path.resolve(__dirname, '../../../circuits/build/verification_key_mode_b.json'),
        path.resolve(__dirname, '../../../../apps/web/public/zk/verification_key_mode_b.json'),
        path.resolve(__dirname, '../../../web/public/zk/verification_key_mode_b.json'),
        path.resolve(process.cwd(), '../../packages/circuits/build/verification_key_mode_b.json'),
        path.resolve(process.cwd(), '../packages/circuits/build/verification_key_mode_b.json'),
        path.resolve(process.cwd(), 'packages/circuits/build/verification_key_mode_b.json'),
        path.resolve(process.cwd(), '../web/public/zk/verification_key_mode_b.json'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          cachedVKeyModeB = JSON.parse(fs.readFileSync(cand, 'utf8'));
          break;
        }
      }
      if (!cachedVKeyModeB) {
        throw new Error('Groth16 Mode B verification key file not found');
      }
    }
    return cachedVKeyModeB;
  }

  if (!cachedVKeyModeA) {
    const candidates = [
      path.resolve(__dirname, '../../../../packages/circuits/build/verification_key.json'),
      path.resolve(__dirname, '../../../circuits/build/verification_key.json'),
      path.resolve(__dirname, '../../../../apps/web/public/zk/verification_key.json'),
      path.resolve(__dirname, '../../../web/public/zk/verification_key.json'),
      path.resolve(process.cwd(), '../../packages/circuits/build/verification_key.json'),
      path.resolve(process.cwd(), '../packages/circuits/build/verification_key.json'),
      path.resolve(process.cwd(), 'packages/circuits/build/verification_key.json'),
      path.resolve(process.cwd(), '../web/public/zk/verification_key.json'),
      path.resolve(process.cwd(), 'verification_key.json'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        cachedVKeyModeA = JSON.parse(fs.readFileSync(cand, 'utf8'));
        break;
      }
    }
    if (!cachedVKeyModeA) {
      throw new Error('Groth16 verification key file not found');
    }
  }
  return cachedVKeyModeA;
}

/**
 * @notice Verifies a submitted Groth16 presentation proof against an active session.
 */
export async function verifyPresentationSubmission(
  sessionId: string,
  submission: PresentationSubmission,
): Promise<{ success: boolean; reasonCode: string; error?: string; receipt?: VerificationReceipt }> {
  const session = await prisma.verificationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { success: false, reasonCode: 'SESSION_NOT_FOUND', error: 'Verification session not found' };
  }

  if (session.status === 'VERIFIED') {
    return { success: false, reasonCode: 'SESSION_ALREADY_VERIFIED', error: 'Session was already verified' };
  }

  if (new Date() > session.expiresAt) {
    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { status: 'EXPIRED' },
    });
    return { success: false, reasonCode: 'SESSION_EXPIRED', error: 'Session has expired' };
  }

  const { proof, publicSignals } = submission;
  if (!proof || !publicSignals || publicSignals.length !== 26) {
    return {
      success: false,
      reasonCode: 'MALFORMED_PROOF',
      error: `Invalid proof payload or signals length (expected 26, received ${publicSignals?.length})`,
    };
  }

  // 1. Determine verification mode (Mode A vs Mode B SMT non-membership)
  const request = JSON.parse(session.requestJson) as {
    mode?: 'MODE_A' | 'MODE_B';
    trustedIssuerKeyHashes?: string[];
    requiredAttributes?: number[];
    requiredPredicates?: Array<{ index: number; minThreshold: number }>;
  };

  const isModeB = submission.mode === 'MODE_B' || request.mode === 'MODE_B';
  const vKey = getVerificationKey(isModeB ? 'MODE_B' : 'MODE_A');

  // Verify Groth16 SNARK proof mathematically
  const isProofValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  if (!isProofValid) {
    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { status: 'REJECTED' },
    });
    return { success: false, reasonCode: 'INVALID_ZK_PROOF', error: 'Groth16 cryptographic proof verification failed' };
  }

  let credentialId: string;
  let issuerKeyHash: string;
  let proofChallenge: string;
  let proofCurrentTime: bigint;
  const disclosedAttrs: Record<number, string> = {};
  const satisfiedPreds: Array<{ index: number; threshold: string }> = [];

function toHex32(val: string): string {
  if (!val) return '0x' + '0'.repeat(64);
  try {
    const bi = BigInt(val);
    return '0x' + bi.toString(16).padStart(64, '0');
  } catch {
    return val.toLowerCase();
  }
}

  if (isModeB) {
    // Mode B public signals layout:
    // [0] = issuerKeyHash
    // [1..8] = revealMask[0..7]
    // [9..16] = revealedValues[0..7]
    // [17..18] = predEnable[0..1]
    // [19..20] = predIndex[0..1]
    // [21..22] = predThreshold[0..1]
    // [23] = currentTime
    // [24] = challenge
    // [25] = revocationRoot
    issuerKeyHash = toHex32(publicSignals[0]!);
    proofCurrentTime = BigInt(publicSignals[23]!);
    proofChallenge = publicSignals[24]!;
    const revocationRoot = toHex32(publicSignals[25]!);
    credentialId = 'ANONYMOUS_IN_CIRCUIT_SMT';

    for (let i = 0; i < 8; i++) {
      if (publicSignals[1 + i] === '1') {
        disclosedAttrs[i] = publicSignals[9 + i]!;
      }
    }

    for (let p = 0; p < 2; p++) {
      if (publicSignals[17 + p] === '1') {
        satisfiedPreds.push({
          index: Number(publicSignals[19 + p]),
          threshold: publicSignals[21 + p]!,
        });
      }
    }

    // 2. Validate SMT revocation root against active or historical tree roots
    const leaves = await prisma.revocationLeaf.findMany({
      where: {
        OR: [
          { issuerKeyHash },
          { issuerKeyHash: publicSignals[0]! },
        ],
      },
    });
    const smt = await createSparseMerkleTree();
    for (const l of leaves) {
      await smt.insert(BigInt(l.credentialId), 1n);
    }
    const currentRoot = toHex32(smt.getRoot().toString());

    const historicalRoot = await prisma.smtRoot.findFirst({
      where: {
        OR: [
          { issuerKeyHash, root: revocationRoot },
          { issuerKeyHash, root: publicSignals[25]! },
          { issuerKeyHash: publicSignals[0]!, root: revocationRoot },
          { issuerKeyHash: publicSignals[0]!, root: publicSignals[25]! },
        ],
      },
    });

    if (
      revocationRoot.toLowerCase() !== currentRoot.toLowerCase() &&
      !historicalRoot
    ) {
      await prisma.verificationSession.update({
        where: { id: sessionId },
        data: { status: 'REJECTED' },
      });
      return {
        success: false,
        reasonCode: 'INVALID_REVOCATION_ROOT',
        error: 'Sparse Merkle Tree revocation root is invalid or not registered for this issuer',
      };
    }
  } else {
    // Mode A public signals layout:
    // [0] = credentialId
    // [1] = issuerKeyHash
    // [2..9] = revealMask[0..7]
    // [10..17] = revealedValues[0..7]
    // [18..19] = predEnable[0..1]
    // [20..21] = predIndex[0..1]
    // [22..23] = predThreshold[0..1]
    // [24] = currentTime
    // [25] = challenge
    credentialId = publicSignals[0]!;
    issuerKeyHash = toHex32(publicSignals[1]!);
    proofCurrentTime = BigInt(publicSignals[24]!);
    proofChallenge = publicSignals[25]!;

    for (let i = 0; i < 8; i++) {
      if (publicSignals[2 + i] === '1') {
        disclosedAttrs[i] = publicSignals[10 + i]!;
      }
    }

    for (let p = 0; p < 2; p++) {
      if (publicSignals[18 + p] === '1') {
        satisfiedPreds.push({
          index: Number(publicSignals[20 + p]),
          threshold: publicSignals[22 + p]!,
        });
      }
    }

    // Check if credentialId is revoked in database
    const revocationRecord = await prisma.revocationLeaf.findFirst({
      where: {
        OR: [
          { credentialId },
          { credentialId: toHex32(credentialId) },
        ],
      },
    });
    if (revocationRecord) {
      await prisma.verificationSession.update({
        where: { id: sessionId },
        data: { status: 'REJECTED' },
      });
      return { success: false, reasonCode: 'CREDENTIAL_REVOKED', error: 'Credential has been revoked by issuer' };
    }
  }

  // 3. Check challenge nonce matches session
  if (BigInt(proofChallenge).toString() !== BigInt(session.challenge).toString()) {
    return { success: false, reasonCode: 'CHALLENGE_MISMATCH', error: 'Proof challenge does not match session challenge' };
  }

  // 4. Check currentTime is within ±5 minutes of server time
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const diffSec = proofCurrentTime > nowSec ? proofCurrentTime - nowSec : nowSec - proofCurrentTime;
  if (diffSec > BigInt(TOLERANCE_WINDOW_SECONDS)) {
    return { success: false, reasonCode: 'TIMESTAMP_OUT_OF_BOUNDS', error: 'Proof currentTime outside tolerance window' };
  }

  // 5. Check trusted issuers if specified
  if (request.trustedIssuerKeyHashes && request.trustedIssuerKeyHashes.length > 0) {
    const isTrusted = request.trustedIssuerKeyHashes.some(
      (h) => toHex32(h).toLowerCase() === toHex32(issuerKeyHash).toLowerCase(),
    );
    if (!isTrusted) {
      return { success: false, reasonCode: 'UNTRUSTED_ISSUER', error: 'Issuer key hash is not in trusted issuers list' };
    }
  }

  // 6. Check required attribute disclosures
  if (request.requiredAttributes) {
    for (const reqIdx of request.requiredAttributes) {
      if (!disclosedAttrs[reqIdx]) {
        return { success: false, reasonCode: 'MISSING_REQUIRED_ATTRIBUTE', error: `Required attribute slot ${reqIdx} was not disclosed` };
      }
    }
  }

  // 7. Check satisfied predicates
  if (request.requiredPredicates && request.requiredPredicates.length > 0) {
    for (const reqPred of request.requiredPredicates) {
      const match = satisfiedPreds.find(
        (sp) => sp.index === reqPred.index && BigInt(sp.threshold) >= BigInt(reqPred.minThreshold),
      );
      if (!match) {
        return {
          success: false,
          reasonCode: 'PREDICATE_NOT_SATISFIED',
          error: `Required predicate for attribute slot ${reqPred.index} with minimum threshold ${reqPred.minThreshold} was not satisfied`,
        };
      }
    }
  }

  // 8. Sign verification receipt
  const verifiedAt = new Date().toISOString();
  const receiptData = {
    sessionId,
    verifierName: session.verifierName,
    domain: session.domain,
    verifiedAt,
    credentialId,
    issuerKeyHash,
    disclosedAttributes: disclosedAttrs,
    satisfiedPredicates: satisfiedPreds,
  };

  const receiptSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(JSON.stringify(receiptData))
    .digest('hex');

  const receipt: VerificationReceipt = {
    ...receiptData,
    receiptSignature: receiptSig,
  };

  // 9. Update session status to VERIFIED
  await prisma.verificationSession.update({
    where: { id: sessionId },
    data: {
      status: 'VERIFIED',
      resultJson: JSON.stringify(receipt),
      receiptSig,
    },
  });

  // 10. Audit log
  await prisma.auditLog.create({
    data: {
      action: 'PRESENTATION_VERIFIED',
      actor: session.verifierName,
      details: JSON.stringify({
        sessionId,
        domain: session.domain,
        credentialId,
        issuerKeyHash,
      }),
    },
  });

  // 11. Emit SSE update to listening verifier
  const { sessionEvents } = await import('./events.js');
  sessionEvents.emitSessionUpdate(sessionId, {
    status: 'VERIFIED',
    receipt,
  });

  return { success: true, reasonCode: 'OK', receipt };
}
