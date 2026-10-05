import canonicalize from 'canonicalize';

/**
 * @notice Serializes an arbitrary JavaScript object or value into canonical JSON
 *         per RFC 8785 (JSON Canonicalization Scheme - JCS).
 * @param obj The JavaScript object, array, or primitive to canonicalize.
 * @returns Deterministic canonical JSON string.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === undefined) {
    throw new Error('Cannot canonicalize undefined');
  }
  const result = canonicalize(obj);
  if (result === undefined) {
    throw new Error('Failed to produce canonical JSON');
  }
  return result;
}

/**
 * @notice Converts canonical JSON bytes to Uint8Array UTF-8 representation.
 */
export function canonicalJsonBytes(obj: unknown): Uint8Array {
  const json = canonicalJson(obj);
  return new TextEncoder().encode(json);
}
