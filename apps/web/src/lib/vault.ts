/**
 * Encrypted Holder SSI Wallet & Vault Manager
 * - PBKDF2 (600,000 iterations, SHA-256) key derivation from user passphrase
 * - AES-256-GCM vault encryption
 * - Storage of Holder did:key identity, holderSecret, credentials, and audit activity
 * - Encrypted backup export and import
 */

import {
  createHolderIdentity,
  HolderIdentity,
  CredentialPackage,
  bytesToField253,
  fieldToHex,
} from '@zk-docguard/core';

export interface StoredCredential {
  id: string; // credentialId
  docHash: string;
  schemaId: string;
  issuerDid: string;
  degreeTitle: string;
  studentName: string;
  issuedAt: string;
  receivedAt: string;
  pkg: CredentialPackage;
  documentKeyHex?: string; // Hex-encoded AES-256-GCM key for document decryption
  tags?: string[];
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  type: 'CREDENTIAL_RECEIVED' | 'PROOF_GENERATED' | 'BACKUP_EXPORTED' | 'KEY_INITIALIZED';
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface VaultData {
  version: 1;
  identity: {
    did: string;
    seedHex: string; // 32-byte hex
    holderSecretField: string; // Field scalar string
    ed25519PublicKeyHex: string;
    x25519PublicKeyHex: string;
  };
  credentials: StoredCredential[];
  activities: ActivityItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedVaultEnvelope {
  format: 'zk-docguard-vault-v1';
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    saltHex: string;
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    ivHex: string;
    ciphertextBase64: string;
  };
}

const VAULT_STORAGE_KEY = 'zkdg_holder_vault_v1';
const PBKDF2_ITERATIONS = 600000;

// Helper: Hex / Bytes conversions
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const match = clean.match(/.{1,2}/g);
  if (!match) return new Uint8Array(0);
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM-256 CryptoKey from a passphrase and salt using PBKDF2
 */
async function deriveVaultKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = crypto.subtle;
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary VaultData into an EncryptedVaultEnvelope
 */
export async function encryptVault(data: VaultData, passphrase: string): Promise<EncryptedVaultEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );

  return {
    format: 'zk-docguard-vault-v1',
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      saltHex: toHex(salt),
    },
    cipher: {
      algorithm: 'AES-256-GCM',
      ivHex: toHex(iv),
      ciphertextBase64: bytesToBase64(new Uint8Array(encrypted)),
    },
  };
}

/**
 * Decrypts an EncryptedVaultEnvelope into VaultData using a passphrase
 */
export async function decryptVault(envelope: EncryptedVaultEnvelope, passphrase: string): Promise<VaultData> {
  if (envelope.format !== 'zk-docguard-vault-v1') {
    throw new Error(`Unsupported vault format: ${envelope.format}`);
  }

  const salt = fromHex(envelope.kdf.saltHex);
  const iv = fromHex(envelope.cipher.ivHex);
  const ciphertext = base64ToBytes(envelope.cipher.ciphertextBase64);

  const key = await deriveVaultKey(passphrase, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    const text = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(text) as VaultData;
  } catch {
    throw new Error('Incorrect passphrase or corrupted vault envelope');
  }
}

// In-memory unlocked vault cache during active browser session
let cachedUnlockedVault: {
  data: VaultData;
  passphrase: string;
} | null = null;

/**
 * Checks if an encrypted vault exists in local storage
 */
export function hasStoredVault(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(VAULT_STORAGE_KEY));
}

/**
 * Checks if the vault is currently unlocked in memory
 */
export function isVaultUnlocked(): boolean {
  return cachedUnlockedVault !== null;
}

/**
 * Locks the active vault and clears memory
 */
export function lockVault(): void {
  cachedUnlockedVault = null;
}

/**
 * Gets the current unlocked vault data or throws if locked
 */
export function getUnlockedVault(): VaultData {
  if (!cachedUnlockedVault) {
    throw new Error('Vault is locked. Please unlock with your passphrase.');
  }
  return cachedUnlockedVault.data;
}

/**
 * Initializes a brand new Holder wallet vault
 */
export async function createNewVault(
  passphrase: string,
  customSeed?: Uint8Array
): Promise<{ vault: VaultData; identity: HolderIdentity }> {
  const identity = createHolderIdentity(customSeed);
  const seedHex = toHex(identity.privateKey);
  const holderSecretField = fieldToHex(bytesToField253(identity.privateKey));

  const initialData: VaultData = {
    version: 1,
    identity: {
      did: identity.did,
      seedHex,
      holderSecretField,
      ed25519PublicKeyHex: toHex(identity.ed25519PublicKey),
      x25519PublicKeyHex: toHex(identity.x25519PublicKey),
    },
    credentials: [],
    activities: [
      {
        id: `act-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        type: 'KEY_INITIALIZED',
        title: 'Holder Identity Initialized',
        description: `Generated gasless DID: ${identity.did}`,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const envelope = await encryptVault(initialData, passphrase);
  if (typeof window !== 'undefined') {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  }

  cachedUnlockedVault = {
    data: initialData,
    passphrase,
  };

  return { vault: initialData, identity };
}

/**
 * Unlocks the stored vault from localStorage using the user's passphrase
 */
export async function unlockStoredVault(passphrase: string): Promise<VaultData> {
  if (typeof window === 'undefined') {
    throw new Error('Cannot unlock vault in non-browser environment without stored envelope');
  }

  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) {
    throw new Error('No vault found in local storage. Please create a wallet first.');
  }

  const envelope = JSON.parse(raw) as EncryptedVaultEnvelope;
  const data = await decryptVault(envelope, passphrase);

  cachedUnlockedVault = {
    data,
    passphrase,
  };

  return data;
}

/**
 * Saves current in-memory vault updates back to encrypted local storage
 */
export async function saveUnlockedVault(updates?: Partial<VaultData>): Promise<VaultData> {
  if (!cachedUnlockedVault) {
    throw new Error('Vault is locked');
  }

  if (updates) {
    cachedUnlockedVault.data = {
      ...cachedUnlockedVault.data,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  } else {
    cachedUnlockedVault.data.updatedAt = new Date().toISOString();
  }

  const envelope = await encryptVault(cachedUnlockedVault.data, cachedUnlockedVault.passphrase);
  if (typeof window !== 'undefined') {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  }

  return cachedUnlockedVault.data;
}

/**
 * Adds an issued credential package to the holder's vault
 */
export async function addCredentialToVault(
  pkg: CredentialPackage,
  metadata?: {
    documentKeyHex?: string;
    studentName?: string;
    tags?: string[];
  }
): Promise<StoredCredential> {
  const vault = getUnlockedVault();
  const credentialId = pkg.vc.credentialStatus.credentialId;

  // Check if already stored
  const existingIdx = vault.credentials.findIndex((c) => c.id === credentialId);
  const now = new Date().toISOString();

  const subj = pkg.vc.credentialSubject;
  const storedItem: StoredCredential = {
    id: credentialId,
    docHash: String(subj.documentHash || ''),
    schemaId: String(subj.schemaId || ''),
    issuerDid: pkg.vc.issuer,
    degreeTitle: String(subj.degreeName || 'Bachelor of Technology in Computer Science'),
    studentName: metadata?.studentName || String(subj.studentId || 'Holder'),
    issuedAt: pkg.vc.issuanceDate,
    receivedAt: now,
    pkg,
    documentKeyHex: metadata?.documentKeyHex,
    tags: metadata?.tags || ['Academic', 'Degree'],
  };

  let newCredentials = [...vault.credentials];
  if (existingIdx >= 0) {
    newCredentials[existingIdx] = storedItem;
  } else {
    newCredentials = [storedItem, ...newCredentials];
  }

  const newActivity: ActivityItem = {
    id: `act-${Date.now()}`,
    timestamp: now,
    type: 'CREDENTIAL_RECEIVED',
    title: 'Credential Imported',
    description: `Received ${storedItem.degreeTitle} from ${storedItem.issuerDid}`,
    metadata: {
      credentialId,
      docHash: storedItem.docHash,
    },
  };

  await saveUnlockedVault({
    credentials: newCredentials,
    activities: [newActivity, ...vault.activities],
  });

  return storedItem;
}

/**
 * Removes a credential from the vault by ID
 */
export async function removeCredentialFromVault(credentialId: string): Promise<void> {
  const vault = getUnlockedVault();
  const filtered = vault.credentials.filter((c) => c.id !== credentialId);
  await saveUnlockedVault({ credentials: filtered });
}

/**
 * Records an activity event in the audit trail
 */
export async function recordVaultActivity(
  type: ActivityItem['type'],
  title: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const vault = getUnlockedVault();
  const item: ActivityItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    title,
    description,
    metadata,
  };

  await saveUnlockedVault({
    activities: [item, ...vault.activities],
  });
}

/**
 * Exports an encrypted JSON backup payload for download
 */
export async function exportVaultBackup(passphrase?: string): Promise<string> {
  if (!cachedUnlockedVault) {
    throw new Error('Vault must be unlocked to export backup');
  }

  const pass = passphrase || cachedUnlockedVault.passphrase;
  const envelope = await encryptVault(cachedUnlockedVault.data, pass);

  await recordVaultActivity(
    'BACKUP_EXPORTED',
    'Encrypted Backup Exported',
    'Holder generated an encrypted JSON vault recovery archive.'
  );

  return JSON.stringify(envelope, null, 2);
}

/**
 * Imports an encrypted JSON backup file, decrypts it, and restores it
 */
export async function importVaultBackup(backupJsonString: string, passphrase: string): Promise<VaultData> {
  const envelope = JSON.parse(backupJsonString) as EncryptedVaultEnvelope;
  const data = await decryptVault(envelope, passphrase);

  // Store into local storage
  if (typeof window !== 'undefined') {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  }

  cachedUnlockedVault = {
    data,
    passphrase,
  };

  return data;
}

/**
 * Completely resets and wipes the local vault (useful for testing or full account wipe)
 */
export function wipeLocalVault(): void {
  cachedUnlockedVault = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(VAULT_STORAGE_KEY);
  }
}
