import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { encodeBase58 } from '@zk-docguard/core';
import { prisma } from '../db/client.js';

const IPFS_API_URL = process.env.IPFS_API_URL || 'http://localhost:5001';
const LOCAL_STORE_DIR = path.resolve(process.cwd(), '.ipfs_store');

// Ensure local store directory exists
if (!fs.existsSync(LOCAL_STORE_DIR)) {
  fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
}

/**
 * @notice Computes a deterministic standard IPFS CIDv0 (Base58btc multihash sha2-256)
 *         matching IPFS UnixFS / raw block hashing: 0x12 (sha2-256) + 0x20 (32 bytes).
 */
export function computeIpfsCid(buffer: Uint8Array): string {
  const hash = crypto.createHash('sha256').update(buffer).digest();
  const multihash = new Uint8Array(2 + hash.length);
  multihash[0] = 0x12; // sha2-256
  multihash[1] = 0x20; // 32 bytes length
  multihash.set(hash, 2);
  return encodeBase58(multihash);
}

/**
 * @notice Uploads and pins ciphertext to IPFS (attempts live Kubo RPC, falls back to deterministic local store).
 */
export async function uploadToIpfs(
  content: Uint8Array,
  metadata?: Record<string, unknown>,
): Promise<{ cid: string; size: number }> {
  const size = content.length;
  let cid = computeIpfsCid(content);

  // Try live Kubo HTTP RPC if reachable
  try {
    const formData = new FormData();
    const blob = new Blob([Buffer.from(content)], { type: 'application/octet-stream' });
    formData.append('file', blob);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
    const res = await fetch(`${IPFS_API_URL}/api/v0/add?pin=true`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json() as { Hash: string; Size: string };
      if (json.Hash) {
        cid = json.Hash;
      }
    }
  } catch {
    // Kubo unreachable, use local content-addressed storage
  }

  // Store in local content-addressed store
  const filePath = path.resolve(LOCAL_STORE_DIR, cid);
  fs.writeFileSync(filePath, Buffer.from(content));

  // Anchor record in database
  await prisma.pinRecord.upsert({
    where: { cid },
    update: {
      size,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
    create: {
      cid,
      size,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return { cid, size };
}

/**
 * @notice Retrieves ciphertext by CID from live Kubo RPC or local content-addressed storage.
 */
export async function getFromIpfs(cid: string): Promise<Uint8Array | null> {
  // Try live Kubo first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${IPFS_API_URL}/api/v0/cat?arg=${cid}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  } catch {
    // Kubo unreachable, check local store
  }

  // Fallback to local store
  const filePath = path.resolve(LOCAL_STORE_DIR, cid);
  if (fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    return new Uint8Array(buf);
  }

  return null;
}
