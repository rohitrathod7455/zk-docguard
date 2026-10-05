import { describe, it, expect } from 'vitest';
import {
  UNIVERSITY_DEGREE_SCHEMA_DEFINITION,
  CANONICAL_DEGREE_SCHEMA_JSON,
  DEGREE_SCHEMA_ID,
  DegreeCode,
  ProgramCode,
  encodeUniversityDegreeSlots,
  schemaRegistry,
  SchemaRegistry,
} from '../src/schema/index.js';
import { isFieldElement } from '../src/crypto/fields.js';

describe('Schema Registry & Degree Schema (schema/)', () => {
  it('defines canonical JSON and precomputed schemaId', () => {
    expect(CANONICAL_DEGREE_SCHEMA_JSON).toContain('UniversityDegreeCredential');
    expect(isFieldElement(DEGREE_SCHEMA_ID)).toBe(true);
    expect(DEGREE_SCHEMA_ID).toBeGreaterThan(0n);
  });

  it('encodes degree attributes into exactly 8 BN254 field elements', () => {
    const slots = encodeUniversityDegreeSlots({
      holderCommitment: 12345n,
      degreeCode: DegreeCode.BTech,
      programCode: ProgramCode.ComputerScience,
      graduationYear: 2026,
      cgpaX100: 874,
      studentId: 'STU-001',
    });

    expect(slots.length).toBe(8);
    expect(slots[0]).toBe(12345n);
    expect(slots[1]).toBe(DEGREE_SCHEMA_ID); // Default schemaId
    expect(slots[2]).toBe(1n); // BTech
    expect(slots[3]).toBe(101n); // ComputerScience
    expect(slots[4]).toBe(2026n);
    expect(slots[5]).toBe(874n);
    expect(isFieldElement(slots[6]!)).toBe(true); // studentIdHash
    expect(slots[7]).toBe(4102444800n); // Default expiry 2100-01-01
  });

  it('registers and retrieves schemas via SchemaRegistry', () => {
    const registry = new SchemaRegistry();
    const customSchema = {
      $id: 'https://example.com/custom-v1.json',
      title: 'CustomSchema',
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };

    const schemaId = registry.registerSchema(customSchema);
    expect(isFieldElement(schemaId)).toBe(true);

    const retrieved = registry.getSchema(schemaId);
    expect(retrieved?.definition.title).toBe('CustomSchema');
  });

  it('validates data according to registered schema requirements', () => {
    const validData = {
      holderCommitment: '0x1234',
      schemaId: '0x5678',
      degreeCode: 1,
      programCode: 101,
      graduationYear: 2026,
      cgpaX100: 874,
      studentIdHash: '0xabcd',
      expiry: 4102444800,
    };

    const result = schemaRegistry.validateData(DEGREE_SCHEMA_ID, validData);
    expect(result.isValid).toBe(true);

    const invalidData = {
      holderCommitment: '0x1234',
      // Missing required fields
    };

    const invalidResult = schemaRegistry.validateData(DEGREE_SCHEMA_ID, invalidData);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
