import { canonicalJson } from '../crypto/canonical.js';
import { stringToField } from '../crypto/fields.js';

export const UNIVERSITY_DEGREE_SCHEMA_DEFINITION = {
  $id: 'https://zk-docguard.org/schemas/UniversityDegree-v1.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'UniversityDegreeCredential',
  description: 'Academic university degree verifiable credential for ZK-DocGuard',
  type: 'object',
  properties: {
    holderCommitment: {
      type: 'string',
      description: 'Slot 0: Poseidon(holderSecret)',
    },
    schemaId: {
      type: 'string',
      description: 'Slot 1: Canonical schema identifier',
    },
    degreeCode: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5],
      description: 'Slot 2: 1=B.Tech, 2=M.Tech, 3=B.Sc, 4=M.Sc, 5=Ph.D',
    },
    programCode: {
      type: 'integer',
      description: 'Slot 3: Numeric program code e.g. 101 for Computer Science',
    },
    graduationYear: {
      type: 'integer',
      minimum: 1900,
      maximum: 2100,
      description: 'Slot 4: Year of graduation',
    },
    cgpaX100: {
      type: 'integer',
      minimum: 0,
      maximum: 1000,
      description: 'Slot 5: Cumulative Grade Point Average scaled by 100 (e.g. 8.74 -> 874)',
    },
    studentIdHash: {
      type: 'string',
      description: 'Slot 6: 253-bit field element hash of student institutional ID',
    },
    expiry: {
      type: 'integer',
      description: 'Slot 7: UNIX timestamp when credential expires (0 or far-future for permanent)',
    },
  },
  required: [
    'holderCommitment',
    'schemaId',
    'degreeCode',
    'programCode',
    'graduationYear',
    'cgpaX100',
    'studentIdHash',
    'expiry',
  ],
};

/**
 * @notice Canonical schema JSON string.
 */
export const CANONICAL_DEGREE_SCHEMA_JSON = canonicalJson(UNIVERSITY_DEGREE_SCHEMA_DEFINITION);

/**
 * @notice Precomputed schemaId as a 253-bit BN254 field element derived from canonical schema JSON.
 */
export const DEGREE_SCHEMA_ID = stringToField(CANONICAL_DEGREE_SCHEMA_JSON);

export enum DegreeCode {
  BTech = 1,
  MTech = 2,
  BSc = 3,
  MSc = 4,
  PhD = 5,
}

export enum ProgramCode {
  ComputerScience = 101,
  ElectricalEngineering = 102,
  MechanicalEngineering = 103,
  CivilEngineering = 104,
  InformationTechnology = 105,
}

export interface UniversityDegreeAttributes {
  holderCommitment: bigint; // Slot 0
  schemaId?: bigint; // Slot 1 (defaults to DEGREE_SCHEMA_ID)
  degreeCode: DegreeCode | number; // Slot 2
  programCode: ProgramCode | number; // Slot 3
  graduationYear: number; // Slot 4
  cgpaX100: number; // Slot 5
  studentId: string; // Transformed to studentIdHash (Slot 6)
  expiry?: number; // Slot 7 (defaults to 4102444800 = Jan 1 2100)
}

/**
 * @notice Encodes high-level UniversityDegreeAttributes into the 8 fixed BN254 field elements.
 */
export function encodeUniversityDegreeSlots(attrs: UniversityDegreeAttributes): bigint[] {
  const schemaId = attrs.schemaId ?? DEGREE_SCHEMA_ID;
  const studentIdHash = stringToField(attrs.studentId);
  const expiry = attrs.expiry ?? 4102444800; // Default far-future

  return [
    attrs.holderCommitment, // Slot 0
    schemaId, // Slot 1
    BigInt(attrs.degreeCode), // Slot 2
    BigInt(attrs.programCode), // Slot 3
    BigInt(attrs.graduationYear), // Slot 4
    BigInt(attrs.cgpaX100), // Slot 5
    studentIdHash, // Slot 6
    BigInt(expiry), // Slot 7
  ];
}
