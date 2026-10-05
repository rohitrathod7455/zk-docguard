import { verifyCredentialSignature } from '../crypto/eddsa.js';
import { computeCredentialId } from '../crypto/poseidon.js';
import { buildCredentialTree } from '../crypto/tree.js';
import { fieldToHex } from '../crypto/fields.js';
import { VerifiableCredential, UniversityDegreeSubject } from './vc-types.js';

export interface VerifyCredentialOptions {
  issuerPublicKey: {
    x: bigint;
    y: bigint;
  };
  now?: number; // UNIX timestamp in seconds (defaults to Date.now() / 1000)
}

export interface VCVerificationChecks {
  structure: boolean;
  notExpired: boolean;
  signature: boolean;
  credentialIdMatch: boolean;
  commitmentTree?: boolean;
}

export interface VCVerificationResult {
  isValid: boolean;
  error?: string;
  checks: VCVerificationChecks;
}

/**
 * @notice Cryptographically verifies a ZK-DocGuard UniversityDegree Verifiable Credential.
 * @param vc The Verifiable Credential document.
 * @param options Issuer public key and optional current timestamp for expiration checks.
 * @returns Verification result including granular check status.
 */
export async function verifyUniversityDegreeCredential(
  vc: VerifiableCredential<UniversityDegreeSubject>,
  options: VerifyCredentialOptions,
): Promise<VCVerificationResult> {
  const checks: VCVerificationChecks = {
    structure: false,
    notExpired: false,
    signature: false,
    credentialIdMatch: false,
  };

  // 1. Structure validation
  if (
    !vc['@context'] ||
    !Array.isArray(vc['@context']) ||
    !vc['@context'].includes('https://www.w3.org/2018/credentials/v1')
  ) {
    return {
      isValid: false,
      error: "Invalid VC: missing 'https://www.w3.org/2018/credentials/v1' in @context",
      checks,
    };
  }

  if (!vc.type || !Array.isArray(vc.type) || !vc.type.includes('VerifiableCredential')) {
    return {
      isValid: false,
      error: "Invalid VC: missing 'VerifiableCredential' in type array",
      checks,
    };
  }

  if (vc.proof?.type !== 'ZkDocGuardPoseidonEdDSA2026') {
    return {
      isValid: false,
      error: `Unsupported proof type: ${vc.proof?.type}`,
      checks,
    };
  }

  checks.structure = true;

  // 2. Expiration check
  const currentSeconds = options.now ?? Math.floor(Date.now() / 1000);

  if (vc.expirationDate) {
    const expirationSeconds = Math.floor(new Date(vc.expirationDate).getTime() / 1000);
    if (currentSeconds >= expirationSeconds) {
      return {
        isValid: false,
        error: `Credential expired on ${vc.expirationDate}`,
        checks,
      };
    }
  }

  if (vc.credentialSubject.expiry && vc.credentialSubject.expiry > 0) {
    if (currentSeconds >= vc.credentialSubject.expiry) {
      return {
        isValid: false,
        error: `Credential subject expired at timestamp ${vc.credentialSubject.expiry}`,
        checks,
      };
    }
  }

  checks.notExpired = true;

  // 3. Signature verification
  try {
    const credentialRoot = BigInt(vc.proof.credentialRoot);
    const sig = {
      R8x: BigInt(vc.proof.signature.R8x),
      R8y: BigInt(vc.proof.signature.R8y),
      S: BigInt(vc.proof.signature.S),
    };

    const isSigValid = await verifyCredentialSignature(
      credentialRoot,
      sig,
      options.issuerPublicKey,
    );

    if (!isSigValid) {
      return {
        isValid: false,
        error: 'Invalid BabyJubJub EdDSA cryptographic signature over credentialRoot',
        checks,
      };
    }
    checks.signature = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      error: `Signature verification failed: ${msg}`,
      checks,
    };
  }

  // 4. Credential ID verification (domain separation)
  try {
    const credentialRoot = BigInt(vc.proof.credentialRoot);
    const expectedCredentialId = await computeCredentialId(credentialRoot);
    const expectedHex = fieldToHex(expectedCredentialId);

    if (vc.credentialStatus?.credentialId.toLowerCase() !== expectedHex.toLowerCase()) {
      return {
        isValid: false,
        error: `Credential ID mismatch: expected ${expectedHex}, got ${vc.credentialStatus?.credentialId}`,
        checks,
      };
    }
    checks.credentialIdMatch = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      error: `CredentialId validation failed: ${msg}`,
      checks,
    };
  }

  // 5. Commitment tree reconstruction (if salts are provided in proof)
  if (vc.proof.salts && vc.proof.salts.length === 8) {
    try {
      const subject = vc.credentialSubject;
      const values = [
        BigInt(subject.holderCommitment),
        BigInt(subject.schemaId),
        BigInt(subject.degreeCode),
        BigInt(subject.programCode),
        BigInt(subject.graduationYear),
        BigInt(subject.cgpaX100),
        BigInt(subject.studentIdHash),
        BigInt(subject.expiry),
      ];

      const salts = vc.proof.salts.map((s) => BigInt(s));
      const tree = await buildCredentialTree(values, salts);

      if (fieldToHex(tree.root).toLowerCase() !== vc.proof.credentialRoot.toLowerCase()) {
        checks.commitmentTree = false;
        return {
          isValid: false,
          error: 'Reconstructed Merkle commitment tree root does not match proof credentialRoot',
          checks,
        };
      }
      checks.commitmentTree = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.commitmentTree = false;
      return {
        isValid: false,
        error: `Commitment tree reconstruction error: ${msg}`,
        checks,
      };
    }
  }

  return {
    isValid: true,
    checks,
  };
}
