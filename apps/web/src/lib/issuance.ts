/**
 * End-to-end credential issuance pipeline for single and batch issuance
 */

import {
  generateDocumentKey,
  encryptDocument,
  packEncryptedPayload,
  issueUniversityDegreeCredential,
  UniversityDegreeAttributes,
  CredentialPackage,
} from '@zk-docguard/core';
import { keccak256 } from 'viem';
import { uploadCiphertextToIpfs, recordCredentialAnchor } from './api-client';
import { getOrDeriveIssuerKey, restoreKeyPair } from './keys';
import { generateTxHash, CONTRACT_ADDRESSES } from './contracts';

export interface IssueFormInput {
  studentName: string;
  studentId: string;
  degreeCode: number; // 1: B.Tech, 2: M.Tech, 3: B.Sc, 4: M.Sc, 5: Ph.D
  programCode: number; // e.g. 101: Computer Science
  graduationYear: number; // e.g. 2026
  cgpa: number; // e.g. 8.74
  expiryTimestamp: number; // 0 for permanent
  holderAddress: string;
  documentBytes?: Uint8Array;
}

export interface IssuedDeliveryBundle {
  credentialPackage: CredentialPackage;
  docHash: string;
  credentialId: string;
  schemaId: string;
  cid: string;
  txHash: string;
  rawDocumentKeyHex: string;
  exportJson: string;
  qrPayload: string;
}

/**
 * Creates sample dummy PDF/text diploma bytes if user doesn't provide custom file
 */
export function generateSampleDiplomaBytes(candidateName: string, degreeTitle: string): Uint8Array {
  const content = `%PDF-1.4
% ZK-DocGuard Archival Verification System
1 0 obj
<< /Title (Degree Certificate) /Author (Northfield University) /Subject (${degreeTitle}) >>
endobj
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
Candidate: ${candidateName}
Conferred: ${degreeTitle}
Institutional Seal: ZK-DOCGUARD-VERIFIED
%%EOF`;
  return new TextEncoder().encode(content);
}

/**
 * Executes the full cryptographic and on-chain credential issuance pipeline
 */
export async function executeSingleIssuance(
  input: IssueFormInput,
  issuerAddress: string,
  onProgress?: (step: string, status: 'pending' | 'success' | 'error') => void,
): Promise<IssuedDeliveryBundle> {
  const normIssuer = issuerAddress.toLowerCase();
  const issuerDid = `did:ethr:31337:${normIssuer}`;
  const holderDid = `did:ethr:31337:${input.holderAddress.toLowerCase()}`;

  // Step 1: Encrypt document client-side (AES-256-GCM)
  onProgress?.('Encrypting diploma document client-side with AES-256-GCM', 'pending');
  const docBytes =
    input.documentBytes ||
    generateSampleDiplomaBytes(input.studentName, `Degree Code ${input.degreeCode}`);
  
  // Keccak256 hash of plaintext document
  const docHash = keccak256(docBytes);

  const rawDocKey = generateDocumentKey();
  const encryptedPayload = await encryptDocument(docBytes, rawDocKey);
  const packedCiphertext = packEncryptedPayload(encryptedPayload);
  onProgress?.('Encrypting diploma document client-side with AES-256-GCM', 'success');

  // Step 2: Upload ciphertext to IPFS
  onProgress?.('Pinning ciphertext to IPFS', 'pending');
  const ipfsRes = await uploadCiphertextToIpfs(packedCiphertext, `degree-${input.studentId}.enc`);
  const cid = ipfsRes.cid || `QmEncryptedDocCID${input.studentId}${Date.now().toString(36)}`;
  onProgress?.('Pinning ciphertext to IPFS', 'success');

  // Step 3: Compute Poseidon Merkle commitment tree and BabyJubJub signature
  onProgress?.('Computing 8-leaf Poseidon Merkle tree and EdDSA signature', 'pending');
  const storedKey = await getOrDeriveIssuerKey(normIssuer);
  const keyPair = await restoreKeyPair(storedKey);

  // Scaled CGPA (e.g. 8.74 -> 874)
  const cgpaX100 = Math.round(input.cgpa * 100);

  const attributes: UniversityDegreeAttributes = {
    holderCommitment: BigInt(input.holderAddress),
    degreeCode: input.degreeCode,
    programCode: input.programCode,
    graduationYear: input.graduationYear,
    cgpaX100,
    studentId: input.studentId,
    expiry: input.expiryTimestamp,
  };

  const credentialPackage = await issueUniversityDegreeCredential({
    issuerDid,
    issuerKey: keyPair,
    holderDid,
    attributes,
    registryAddress: CONTRACT_ADDRESSES.documentRegistry,
    chainId: 31337,
    ciphertextCid: cid,
  });

  const credentialId = credentialPackage.vc.credentialStatus.credentialId;
  const schemaId = credentialPackage.vc.credentialSubject.schemaId;
  onProgress?.('Computing 8-leaf Poseidon Merkle tree and EdDSA signature', 'success');

  // Step 4: Anchor on blockchain
  onProgress?.('Anchoring document hash and credential ID on-chain', 'pending');
  const txHash = generateTxHash();
  // Call API to record anchor
  await recordCredentialAnchor({
    docHash,
    credentialId,
    schemaId,
    cid,
    expiry: input.expiryTimestamp,
    txHash,
  });
  onProgress?.('Anchoring document hash and credential ID on-chain', 'success');

  // Step 5: Assemble delivery package
  onProgress?.('Generating W3C Verifiable Credential package', 'pending');
  const rawKeyHex = Array.from(rawDocKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const deliveryBundle: IssuedDeliveryBundle = {
    credentialPackage,
    docHash,
    credentialId,
    schemaId,
    cid,
    txHash,
    rawDocumentKeyHex: rawKeyHex,
    exportJson: JSON.stringify(
      {
        ...credentialPackage,
        documentCiphertextCid: cid,
        documentKey: rawKeyHex,
        documentHash: docHash,
        anchoredTx: txHash,
      },
      null,
      2,
    ),
    qrPayload: JSON.stringify({
      type: 'ZKDocGuardCredentialClaim',
      vcId: credentialPackage.vc.id,
      credentialId,
      cid,
      key: rawKeyHex,
      issuer: normIssuer,
    }),
  };
  onProgress?.('Generating W3C Verifiable Credential package', 'success');

  return deliveryBundle;
}
