import { describe, it, expect, vi } from 'vitest';
import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import {
  getRegistryAddresses,
  KNOWN_ADDRESSES,
  getIssuerRegistryContract,
  getDocumentRegistryContract,
  getRevocationRegistryContract,
  isZkKeyActiveOnChain,
  getIssuerStatusOnChain,
  verifyDocumentOnChain,
  isCredentialRevokedOnChain,
  isRevocationRootValidOnChain,
} from '../src/contracts/client.js';

describe('Smart Contract Client Wrappers (contracts/client.ts)', () => {
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(),
  });

  it('resolves hardhat (31337) deployment addresses accurately', () => {
    const addresses = getRegistryAddresses(31337);
    expect(addresses.issuerRegistry).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    expect(addresses.documentRegistry).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    expect(addresses.revocationRegistry).toBe('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0');

    expect(KNOWN_ADDRESSES[31337]).toEqual(addresses);
  });

  it('throws when resolving addresses for unknown chain ID', () => {
    expect(() => getRegistryAddresses(999999)).toThrow(
      'No deployment addresses recorded for chain ID 999999',
    );
  });

  it('creates viem contract instances for all registries', () => {
    const issuerContract = getIssuerRegistryContract({ publicClient });
    expect(issuerContract.address.toLowerCase()).toBe(
      KNOWN_ADDRESSES[31337]?.issuerRegistry.toLowerCase(),
    );

    const docContract = getDocumentRegistryContract({ publicClient });
    expect(docContract.address.toLowerCase()).toBe(
      KNOWN_ADDRESSES[31337]?.documentRegistry.toLowerCase(),
    );

    const revContract = getRevocationRegistryContract({ publicClient });
    expect(revContract.address.toLowerCase()).toBe(
      KNOWN_ADDRESSES[31337]?.revocationRegistry.toLowerCase(),
    );
  });

  it('accepts custom address overrides for contract instances', () => {
    const customAddr = '0x1111111111111111111111111111111111111111';
    const contract = getIssuerRegistryContract({ publicClient, address: customAddr });
    expect(contract.address).toBe(customAddr);
  });

  it('throws if contract address is missing when chain is unknown and no address is provided', () => {
    const unconfiguredClient = createPublicClient({
      transport: http('http://127.0.0.1:8545'),
    });

    expect(() => getIssuerRegistryContract({ publicClient: unconfiguredClient })).toThrow(
      'IssuerRegistry address must be specified',
    );
    expect(() => getDocumentRegistryContract({ publicClient: unconfiguredClient })).toThrow(
      'DocumentRegistry address must be specified',
    );
    expect(() => getRevocationRegistryContract({ publicClient: unconfiguredClient })).toThrow(
      'RevocationRegistry address must be specified',
    );
  });

  it('executes high-level query helpers using mocked readContract calls', async () => {
    const mockClient = {
      chain: hardhat,
      readContract: vi.fn(),
    } as unknown as typeof publicClient;

    // 1. isZkKeyActiveOnChain
    (mockClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const active = await isZkKeyActiveOnChain(
      mockClient,
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    );
    expect(active).toBe(true);

    // 2. getIssuerStatusOnChain
    (mockClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1); // Active
    const status = await getIssuerStatusOnChain(
      mockClient,
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    );
    expect(status).toBe(1);

    // 3. verifyDocumentOnChain
    (mockClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      1, // Valid
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      1700000000n,
      1800000000n,
      'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    ]);
    const doc = await verifyDocumentOnChain(
      mockClient,
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    );
    expect(doc.status).toBe(1);
    expect(doc.cid).toBe('QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');

    // 4. isCredentialRevokedOnChain
    (mockClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const revoked = await isCredentialRevokedOnChain(
      mockClient,
      '0x2222222222222222222222222222222222222222222222222222222222222222',
    );
    expect(revoked).toBe(false);

    // 5. isRevocationRootValidOnChain
    (mockClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const validRoot = await isRevocationRootValidOnChain(
      mockClient,
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444444444444444444444444444',
    );
    expect(validRoot).toBe(true);
  });

  it('query helpers throw when address is not provided and chainId is unknown', async () => {
    const unconfiguredClient = {
      readContract: vi.fn(),
    } as unknown as typeof publicClient;

    await expect(
      isZkKeyActiveOnChain(
        unconfiguredClient,
        '0x1234567890123456789012345678901234567890123456789012345678901234',
      ),
    ).rejects.toThrow('IssuerRegistry address not specified');

    await expect(
      getIssuerStatusOnChain(unconfiguredClient, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
    ).rejects.toThrow('IssuerRegistry address not specified');

    await expect(
      verifyDocumentOnChain(
        unconfiguredClient,
        '0x1111111111111111111111111111111111111111111111111111111111111111',
      ),
    ).rejects.toThrow('DocumentRegistry address not specified');

    await expect(
      isCredentialRevokedOnChain(
        unconfiguredClient,
        '0x2222222222222222222222222222222222222222222222222222222222222222',
      ),
    ).rejects.toThrow('RevocationRegistry address not specified');

    await expect(
      isRevocationRootValidOnChain(
        unconfiguredClient,
        '0x3333333333333333333333333333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444444444444444444444444444',
      ),
    ).rejects.toThrow('RevocationRegistry address not specified');
  });
});
