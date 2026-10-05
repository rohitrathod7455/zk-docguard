import { buildCredentialTree } from '../crypto/tree.js';
import { computeCredentialId } from '../crypto/poseidon.js';
import { signCredentialRoot, BabyJubKeyPair } from '../crypto/eddsa.js';
import { fieldToHex } from '../crypto/fields.js';
import {
  encodeUniversityDegreeSlots,
  UniversityDegreeAttributes,
} from '../schema/degree-schema.js';
import { VerifiableCredential, UniversityDegreeSubject, CredentialPackage } from './vc-types.js';

export interface IssueCredentialOptions {
  issuerDid: string;
  issuerKey: BabyJubKeyPair;
  holderDid: string;
  attributes: UniversityDegreeAttributes;
  registryAddress: string;
  chainId: number;
  customSalts?: bigint[];
  ciphertextCid?: string;
  wrappedKey?: {
    ephemeralPublicKey: string;
    iv: string;
    wrappedKey: string;
  };
}

/**
 * @notice Assembles, commits, signs, and formats a W3C-compliant Verifiable Credential
 *         anchored to the ZK-DocGuard protocol.
 */
export async function issueUniversityDegreeCredential(
  options: IssueCredentialOptions,
): Promise<CredentialPackage> {
  const {
    issuerDid,
    issuerKey,
    holderDid,
    attributes,
    registryAddress,
    chainId,
    customSalts,
    ciphertextCid,
    wrappedKey,
  } = options;

  // 1. Encode into 8 field element slots
  const values = encodeUniversityDegreeSlots(attributes);

  // 2. Build depth-3 Poseidon binary Merkle commitment tree
  const tree = await buildCredentialTree(values, customSalts);

  // 3. Compute domain-separated credentialId = Poseidon(credentialRoot, 1)
  const credentialId = await computeCredentialId(tree.root);

  // 4. Issuer signs credentialRoot using BabyJubJub EdDSA-Poseidon
  const signature = await signCredentialRoot(issuerKey.privateKey, tree.root);

  const now = new Date();
  const issuanceDate = now.toISOString();
  const expiryTimestamp = Number(values[7]!);
  const expirationDate =
    expiryTimestamp > 0 ? new Date(expiryTimestamp * 1000).toISOString() : undefined;

  const credentialSubject: UniversityDegreeSubject = {
    id: holderDid,
    holderCommitment: fieldToHex(values[0]!),
    schemaId: fieldToHex(values[1]!),
    degreeCode: Number(values[2]!),
    programCode: Number(values[3]!),
    graduationYear: Number(values[4]!),
    cgpaX100: Number(values[5]!),
    studentIdHash: fieldToHex(values[6]!),
    expiry: expiryTimestamp,
  };

  const vc: VerifiableCredential<UniversityDegreeSubject> = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://zk-docguard.org/credentials/v1',
    ],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: issuerDid,
    issuanceDate,
    expirationDate,
    credentialSubject,
    credentialStatus: {
      id: `${registryAddress}#${fieldToHex(credentialId)}`,
      type: 'ZkDocGuardOnChainRegistry2026',
      credentialId: fieldToHex(credentialId),
      registryAddress,
      chainId,
    },
    proof: {
      type: 'ZkDocGuardPoseidonEdDSA2026',
      created: issuanceDate,
      verificationMethod: `${issuerDid}#babyjubjub-1`,
      proofPurpose: 'assertionMethod',
      credentialRoot: fieldToHex(tree.root),
      signature: {
        R8x: fieldToHex(signature.R8x),
        R8y: fieldToHex(signature.R8y),
        S: signature.S.toString(),
      },
      salts: tree.salts.map((s) => fieldToHex(s)),
    },
  };

  return {
    vc,
    rawValues: values.map((v) => fieldToHex(v)),
    salts: tree.salts.map((s) => fieldToHex(s)),
    ciphertextCid,
    wrappedKey,
  };
}
