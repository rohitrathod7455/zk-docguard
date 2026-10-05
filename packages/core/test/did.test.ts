import { describe, it, expect } from 'vitest';
import {
  encodeBase58,
  decodeBase58,
  createHolderIdentity,
  resolveDidKey,
} from '../src/did/did-key.js';
import { parseDidEthr, buildIssuerDidDocument } from '../src/did/did-ethr.js';
import { isFieldElement } from '../src/crypto/fields.js';

describe('DID Management: did:key and did:ethr (did/)', () => {
  it('encodes and decodes Base58btc accurately including leading zeros', () => {
    const data = new Uint8Array([0, 0, 1, 2, 3, 255]);
    const encoded = encodeBase58(data);
    const decoded = decodeBase58(encoded);
    expect(decoded).toEqual(data);

    expect(encodeBase58(new Uint8Array([]))).toBe('');
    expect(decodeBase58('')).toEqual(new Uint8Array([]));
  });

  it('generates a gasless browser-based holder SSI identity (createHolderIdentity)', async () => {
    const identity = createHolderIdentity();
    expect(identity.did.startsWith('did:key:z')).toBe(true);
    expect(identity.privateKey.length).toBe(32);
    expect(identity.publicKey.length).toBe(32);

    const commitment = await identity.getHolderCommitment();
    expect(isFieldElement(commitment)).toBe(true);
    expect(commitment).toBeGreaterThan(0n);
  });

  it('resolves did:key to a fully compliant W3C DID document', () => {
    const identity = createHolderIdentity();
    const doc = resolveDidKey(identity.did);

    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(doc.id).toBe(identity.did);
    expect(doc.verificationMethod.length).toBe(1);
    expect(doc.verificationMethod[0]?.type).toBe('Ed25519VerificationKey2020');
    expect(doc.authentication).toContain(doc.verificationMethod[0]?.id);
    expect(doc.assertionMethod).toContain(doc.verificationMethod[0]?.id);
  });

  it('rejects malformed did:key strings', () => {
    expect(() => resolveDidKey('did:example:123')).toThrow('Invalid did:key format');
    expect(() => resolveDidKey('did:key:123')).toThrow("did:key multibase must start with 'z'");
  });

  it('parses did:ethr strings with or without network prefix', () => {
    const parsed1 = parseDidEthr('did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(parsed1.address.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    expect(parsed1.network).toBeUndefined();

    const parsed2 = parseDidEthr('did:ethr:amoy:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(parsed2.network).toBe('amoy');
    expect(parsed2.address.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');

    expect(() => parseDidEthr('did:invalid:0x123')).toThrow('Invalid did:ethr identifier');
  });

  it('builds an issuer DID document with ZkDocGuardBabyJubJubKey2026 verification method', () => {
    const did = 'did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const babyJubKey = {
      x: 123456789n,
      y: 987654321n,
    };

    const doc = buildIssuerDidDocument(did, babyJubKey);
    expect(doc.id).toBe(did);
    expect(doc.verificationMethod.length).toBe(2);

    const vm = doc.verificationMethod[1]!;
    expect(vm.type).toBe('ZkDocGuardBabyJubJubKey2026');
    expect(vm.publicKeyJwk?.crv).toBe('BabyJubJub');
  });

  it('formats did:ethr identifiers correctly for mainnet and L2 chains', async () => {
    const { formatDidEthr } = await import('../src/did/did-ethr.js');
    expect(formatDidEthr('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 1)).toBe(
      'did:ethr:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    );
    expect(formatDidEthr('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 80002)).toBe(
      'did:ethr:80002:0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    );
  });

  it('builds an issuer DID document from a full IssuerIdentity object', () => {
    const identity = {
      did: 'did:ethr:80002:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      ethereumAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      chainId: 80002,
      babyJubPublicKey: { x: 101n, y: 202n },
      zkKeyHash: 303n,
    };

    const doc = buildIssuerDidDocument(identity);
    expect(doc.id).toBe(identity.did);
    expect(doc.verificationMethod.length).toBe(2);
  });
});
