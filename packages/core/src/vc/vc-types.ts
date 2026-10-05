export interface ZkDocGuardProof {
  type: 'ZkDocGuardPoseidonEdDSA2026';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  credentialRoot: string; // 0x hex
  signature: {
    R8x: string; // 0x hex
    R8y: string; // 0x hex
    S: string; // 0x hex
  };
  salts?: string[]; // 0x hex array of 8 salts (retained client-side by holder)
}

export interface CredentialStatus {
  id: string; // Registry address + # + credentialId
  type: 'ZkDocGuardOnChainRegistry2026';
  credentialId: string; // 0x hex
  registryAddress: string;
  chainId: number;
}

export interface UniversityDegreeSubject {
  id: string; // Holder did:key
  holderCommitment: string;
  schemaId: string;
  degreeCode: number;
  programCode: number;
  graduationYear: number;
  cgpaX100: number;
  studentIdHash: string;
  expiry: number;
  [key: string]: unknown;
}

export interface VerifiableCredential<T = Record<string, unknown>> {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string; // did:ethr:...
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: T;
  credentialStatus: CredentialStatus;
  proof: ZkDocGuardProof;
}

export interface CredentialPackage {
  vc: VerifiableCredential<UniversityDegreeSubject>;
  rawValues: string[]; // Array of 8 hex strings
  salts: string[]; // Array of 8 hex strings
  ciphertextCid?: string;
  wrappedKey?: {
    ephemeralPublicKey: string;
    iv: string;
    wrappedKey: string;
  };
}
