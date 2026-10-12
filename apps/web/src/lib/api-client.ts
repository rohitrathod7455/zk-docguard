/**
 * API client for ZK-DocGuard Fastify backend service (/v1)
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface IssuerRecord {
  address: string;
  did: string;
  zkKeyHash: string;
  metadataURI: string;
  status: 'Pending' | 'Active' | 'Suspended' | 'Revoked';
  registeredAt: string;
  keyEpoch: number;
  approvedAt?: string | null;
}

export interface CredentialRecordDto {
  docHash: string;
  credentialId: string;
  schemaId: string;
  cid: string;
  status: 'Valid' | 'Revoked' | 'Expired';
  txHash?: string | null;
  issuerAddress: string;
  issuedAt: string;
  expiry: string;
  issuer?: IssuerRecord;
}

export interface AuditLogDto {
  id: string;
  action: string;
  actor: string;
  details?: string | null;
  timestamp: string;
}

/**
 * Fetch all institutional issuers
 */
export async function getIssuers(status?: string): Promise<IssuerRecord[]> {
  const url = new URL(`${API_BASE_URL}/v1/issuers`);
  if (status) url.searchParams.set('status', status);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.issuers || [];
  } catch {
    // Return seeded demo issuers if API is unreachable
    return [
      {
        address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase(),
        did: 'did:ethr:31337:0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        zkKeyHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        metadataURI: 'ipfs://QmNorthfieldUniversityInstitutionalMetadata',
        status: 'Active',
        registeredAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        keyEpoch: 1,
        approvedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
      },
    ];
  }
}

/**
 * Fetch issuer profile by address
 */
export async function getIssuer(address: string): Promise<IssuerRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/issuers/${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.issuer || null;
  } catch {
    return null;
  }
}

/**
 * Submit an institutional onboarding application
 */
export async function applyIssuer(payload: {
  address: string;
  did: string;
  zkKeyHash: string;
  metadataURI: string;
}): Promise<{ ok: boolean; issuer?: IssuerRecord; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/issuers/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to submit application' };
    }
    return { ok: true, issuer: data.issuer };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Admin: approve an issuer
 */
export async function adminApproveIssuer(
  address: string,
): Promise<{ ok: boolean; issuer?: IssuerRecord; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/admin/issuers/${address}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to approve issuer' };
    }
    return { ok: true, issuer: data.issuer };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Admin: suspend an issuer
 */
export async function adminSuspendIssuer(
  address: string,
): Promise<{ ok: boolean; issuer?: IssuerRecord; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/admin/issuers/${address}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to suspend issuer' };
    }
    return { ok: true, issuer: data.issuer };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Upload ciphertext to IPFS pin endpoint
 */
export async function uploadCiphertextToIpfs(
  ciphertextBytes: Uint8Array,
  filename = 'credential-ciphertext.bin',
): Promise<{ ok: boolean; cid?: string; error?: string }> {
  try {
    const base64Data =
      typeof Buffer !== 'undefined'
        ? Buffer.from(ciphertextBytes).toString('base64')
        : btoa(Array.from(ciphertextBytes, (b) => String.fromCharCode(b)).join(''));

    const res = await fetch(`${API_BASE_URL}/v1/ipfs/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ciphertext: base64Data,
        metadata: {
          algorithm: 'AES-256-GCM',
          tagLength: 128,
          filename,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'IPFS upload failed' };
    }
    return { ok: true, cid: data.cid };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}


/**
 * Record an on-chain anchored credential
 */
export async function recordCredentialAnchor(payload: {
  docHash: string;
  credentialId: string;
  schemaId: string;
  cid: string;
  expiry: string | number;
  txHash: string;
}): Promise<{ ok: boolean; record?: CredentialRecordDto; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/credentials/anchor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to record anchor' };
    }
    return { ok: true, record: data.record };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * List credentials filtered by issuer or status
 */
export async function getCredentials(params?: {
  issuerAddress?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; records: CredentialRecordDto[] }> {
  const url = new URL(`${API_BASE_URL}/v1/credentials`);
  if (params?.issuerAddress) url.searchParams.set('issuerAddress', params.issuerAddress);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.limit) url.searchParams.set('limit', params.limit.toString());
  if (params?.offset) url.searchParams.set('offset', params.offset.toString());

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { total: data.total || 0, records: data.records || [] };
  } catch {
    return { total: 0, records: [] };
  }
}

/**
 * Revoke credential in API (SMT leaf sync)
 */
export async function recordRevocation(payload: {
  credentialId: string;
  issuerKeyHash: string;
  reasonCode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/revocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to sync revocation' };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}
