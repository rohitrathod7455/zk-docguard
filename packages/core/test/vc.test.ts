import { describe, it, expect } from 'vitest';
import {
  issueUniversityDegreeCredential,
  verifyUniversityDegreeCredential,
} from '../src/vc/index.js';
import { DegreeCode, ProgramCode } from '../src/schema/index.js';
import { deriveBabyJubKeyPair } from '../src/crypto/eddsa.js';
import { createHolderIdentity } from '../src/did/did-key.js';

describe('W3C Verifiable Credentials (vc-builder & vc-verifier)', () => {
  // Deterministic 32-byte private key for testing
  const dummyIssuerKeyBytes = new Uint8Array(32).fill(7);
  const issuerDid = 'did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  async function setupCredential(expiry?: number) {
    const issuerKeyPair = await deriveBabyJubKeyPair(dummyIssuerKeyBytes);
    const holder = createHolderIdentity();
    const holderCommitment = await holder.getHolderCommitment();

    const credPkg = await issueUniversityDegreeCredential({
      issuerDid,
      issuerKey: issuerKeyPair,
      holderDid: holder.did,
      attributes: {
        holderCommitment,
        degreeCode: DegreeCode.BTech,
        programCode: ProgramCode.ComputerScience,
        graduationYear: 2026,
        cgpaX100: 874, // 8.74 CGPA
        studentId: 'STUDENT-2022-CSE-042',
        expiry,
      },
      registryAddress,
      chainId,
    });

    return { credPkg, issuerKeyPair, holder };
  }

  it('issues and verifies a university degree verifiable credential end-to-end', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    expect(credPkg.rawValues.length).toBe(8);
    expect(credPkg.salts.length).toBe(8);
    expect(credPkg.vc.proof.salts?.length).toBe(8);

    const verification = await verifyUniversityDegreeCredential(credPkg.vc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });

    expect(verification.isValid).toBe(true);
    expect(verification.checks.structure).toBe(true);
    expect(verification.checks.notExpired).toBe(true);
    expect(verification.checks.signature).toBe(true);
    expect(verification.checks.credentialIdMatch).toBe(true);
    expect(verification.checks.commitmentTree).toBe(true);
  });

  it('detects tampering of attributes via commitment tree reconstruction failure', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    // Tamper with CGPA in the credential subject: 874 -> 999
    const tamperedVc = {
      ...credPkg.vc,
      credentialSubject: {
        ...credPkg.vc.credentialSubject,
        cgpaX100: 999,
      },
    };

    const verification = await verifyUniversityDegreeCredential(tamperedVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });

    expect(verification.isValid).toBe(false);
    expect(verification.checks.commitmentTree).toBe(false);
    expect(verification.error).toContain(
      'Reconstructed Merkle commitment tree root does not match',
    );
  });

  it('detects tampering of cryptographic signature', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    // Tamper with signature S
    const tamperedVc = {
      ...credPkg.vc,
      proof: {
        ...credPkg.vc.proof,
        signature: {
          ...credPkg.vc.proof.signature,
          S: (BigInt(credPkg.vc.proof.signature.S) + 1n).toString(),
        },
      },
    };

    const verification = await verifyUniversityDegreeCredential(tamperedVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });

    expect(verification.isValid).toBe(false);
    expect(verification.checks.signature).toBe(false);
    expect(verification.error).toContain('Invalid BabyJubJub EdDSA');
  });

  it('detects tampering of credentialId', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    // Tamper credentialId
    const tamperedVc = {
      ...credPkg.vc,
      credentialStatus: {
        ...credPkg.vc.credentialStatus,
        credentialId: '0x0000000000000000000000000000000000000000000000000000000000000123',
      },
    };

    const verification = await verifyUniversityDegreeCredential(tamperedVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });

    expect(verification.isValid).toBe(false);
    expect(verification.checks.credentialIdMatch).toBe(false);
    expect(verification.error).toContain('Credential ID mismatch');
  });

  it('detects expired credentials', async () => {
    const pastTimestamp = 1600000000; // Sept 2020
    const { credPkg, issuerKeyPair } = await setupCredential(pastTimestamp);

    const verification = await verifyUniversityDegreeCredential(credPkg.vc, {
      issuerPublicKey: issuerKeyPair.publicKey,
      now: 1700000000, // 2023 (after expiration)
    });

    expect(verification.isValid).toBe(false);
    expect(verification.checks.notExpired).toBe(false);
    expect(verification.error).toContain('expired');
  });

  it('rejects credentials with invalid context or proof type', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    const badContextVc = { ...credPkg.vc, '@context': ['https://other.com'] };
    const res1 = await verifyUniversityDegreeCredential(badContextVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('missing');

    const badTypeVc = {
      ...credPkg.vc,
      type: ['OtherCredential'],
    };
    const res3 = await verifyUniversityDegreeCredential(badTypeVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
    });
    expect(res3.isValid).toBe(false);
    expect(res3.error).toContain("missing 'VerifiableCredential'");
  });

  it('detects expiration when subject.expiry is in the past without expirationDate', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    const expiredSubjectVc = {
      ...credPkg.vc,
      expirationDate: undefined,
      credentialSubject: {
        ...credPkg.vc.credentialSubject,
        expiry: 1600000000, // Year 2020
      },
    };

    const res = await verifyUniversityDegreeCredential(expiredSubjectVc, {
      issuerPublicKey: issuerKeyPair.publicKey,
      now: 1700000000,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Credential subject expired');
  });

  it('catches and reports exceptions during verification gracefully', async () => {
    const { credPkg, issuerKeyPair } = await setupCredential();

    // Malformed proof.credentialRoot that fails BigInt conversion
    const malformedVc = {
      ...credPkg.vc,
      proof: {
        ...credPkg.vc.proof,
        credentialRoot: 'not-a-number',
      },
    };

    const res = await verifyUniversityDegreeCredential(
      malformedVc as unknown as typeof credPkg.vc,
      {
        issuerPublicKey: issuerKeyPair.publicKey,
      },
    );
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Signature verification failed');
  });
});
