import * as crypto from 'node:crypto';
import { SiweMessage } from 'siwe';
import { verifyMessage } from 'viem';
import { prisma } from '../db/client.js';

export type UserRole = 'admin' | 'issuer' | 'user';

export interface SessionData {
  address: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-key-zk-docguard-minimum-32-chars!!';
const ADMIN_ADDRESS = (process.env.ADMIN_ADDRESS || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266').toLowerCase();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @notice Generates a cryptographically random, replay-safe SIWE nonce.
 */
export async function createSiweNonce(): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  await prisma.siweNonce.create({
    data: {
      nonce,
      expiresAt,
    },
  });

  return nonce;
}

/**
 * @notice Verifies a SIWE message and signature, checks nonce freshness, and determines user roles.
 */
export async function verifySiweMessage(
  messageStr: string,
  signature: string,
): Promise<{ success: boolean; error?: string; session?: SessionData }> {
  try {
    const siweMessage = new SiweMessage(messageStr);
    const nonceRecord = await prisma.siweNonce.findUnique({
      where: { nonce: siweMessage.nonce },
    });

    if (!nonceRecord) {
      return { success: false, error: 'Invalid or already consumed nonce' };
    }

    if (new Date() > nonceRecord.expiresAt) {
      await prisma.siweNonce.delete({ where: { nonce: siweMessage.nonce } });
      return { success: false, error: 'Nonce expired' };
    }

    // Delete nonce immediately to ensure single-use replay protection
    await prisma.siweNonce.delete({ where: { nonce: siweMessage.nonce } });

    // Verify cryptographic signature via viem
    const isValidSignature = await verifyMessage({
      address: siweMessage.address as `0x${string}`,
      message: messageStr,
      signature: signature as `0x${string}`,
    });

    if (!isValidSignature) {
      return { success: false, error: 'Signature verification failed' };
    }

    const address = siweMessage.address.toLowerCase();

    // Determine role: Admin takes highest precedence
    let role: UserRole = 'user';
    if (address === ADMIN_ADDRESS) {
      role = 'admin';
    } else {
      const issuer = await prisma.issuer.findUnique({
        where: { address },
      });
      if (issuer && issuer.status === 'Active') {
        role = 'issuer';
      }
    }

    const now = Date.now();
    const session: SessionData = {
      address,
      role,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };

    return { success: true, session };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * @notice Serializes and HMAC-signs session data into a secure cookie value.
 */
export function sealSession(session: SessionData): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

/**
 * @notice Verifies and unpacks an HMAC-signed session cookie value.
 */
export function unsealSession(cookieValue: string): SessionData | null {
  try {
    const [payload, sig] = cookieValue.split('.');
    if (!payload || !sig) return null;

    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedHmac))) {
      return null;
    }

    const session: SessionData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() > session.expiresAt) {
      return null; // Expired session
    }

    return session;
  } catch {
    return null;
  }
}
