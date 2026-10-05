import { canonicalJson } from '../crypto/canonical.js';
import { stringToField } from '../crypto/fields.js';
import { UNIVERSITY_DEGREE_SCHEMA_DEFINITION, DEGREE_SCHEMA_ID } from './degree-schema.js';

export interface RegisteredSchema {
  schemaId: bigint;
  schemaIdHex: string;
  definition: Record<string, unknown>;
  canonicalJson: string;
}

export class SchemaRegistry {
  private _schemas: Map<string, RegisteredSchema> = new Map();

  constructor() {
    this.register(UNIVERSITY_DEGREE_SCHEMA_DEFINITION, DEGREE_SCHEMA_ID);
  }

  /**
   * @notice Registers a JSON schema, computing its canonical schemaId if not provided.
   */
  register(schemaDefinition: Record<string, unknown>, explicitSchemaId?: bigint): RegisteredSchema {
    const cJson = canonicalJson(schemaDefinition);
    const schemaId = explicitSchemaId ?? stringToField(cJson);
    const schemaIdHex = '0x' + schemaId.toString(16);

    const record: RegisteredSchema = {
      schemaId,
      schemaIdHex,
      definition: schemaDefinition,
      canonicalJson: cJson,
    };

    this._schemas.set(schemaIdHex.toLowerCase(), record);
    return record;
  }

  registerSchema(schemaDefinition: Record<string, unknown>, explicitSchemaId?: bigint): bigint {
    const reg = this.register(schemaDefinition, explicitSchemaId);
    return reg.schemaId;
  }

  /**
   * @notice Retrieves a registered schema by its schemaId (bigint or hex string).
   */
  get(schemaId: bigint | string): RegisteredSchema | undefined {
    let key: string;
    if (typeof schemaId === 'bigint') {
      key = ('0x' + schemaId.toString(16)).toLowerCase();
    } else {
      key = (schemaId.startsWith('0x') ? schemaId : '0x' + schemaId).toLowerCase();
    }
    return this._schemas.get(key);
  }

  getSchema(schemaId: bigint | string): RegisteredSchema | undefined {
    return this.get(schemaId);
  }

  /**
   * @notice Checks if a schemaId is known.
   */
  has(schemaId: bigint | string): boolean {
    return this.get(schemaId) !== undefined;
  }

  /**
   * @notice Validates attributes against the required properties of a registered schema.
   */
  validateData(
    schemaId: bigint | string,
    data: Record<string, unknown>,
  ): { isValid: boolean; errors: string[] } {
    const schema = this.get(schemaId);
    if (!schema) {
      return {
        isValid: false,
        errors: [`Schema not found for schemaId ${schemaId.toString()}`],
      };
    }

    const errors: string[] = [];
    const required = (schema.definition['required'] as string[]) || [];

    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export const schemaRegistry = new SchemaRegistry();
