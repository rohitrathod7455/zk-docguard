import { describe, it, expect } from 'vitest';
import {
  CORE_VERSION,
  IssuerRegistryArtifact,
  DocumentRegistryArtifact,
  RevocationRegistryArtifact,
} from '../src/index.js';

describe('core', () => {
  it('exports a version string', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });

  it('exports contract artifacts with valid ABIs', () => {
    expect(IssuerRegistryArtifact.contractName).toBe('IssuerRegistry');
    expect(Array.isArray(IssuerRegistryArtifact.abi)).toBe(true);

    expect(DocumentRegistryArtifact.contractName).toBe('DocumentRegistry');
    expect(Array.isArray(DocumentRegistryArtifact.abi)).toBe(true);

    expect(RevocationRegistryArtifact.contractName).toBe('RevocationRegistry');
    expect(Array.isArray(RevocationRegistryArtifact.abi)).toBe(true);
  });
});
