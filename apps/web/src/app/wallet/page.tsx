'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  FileText,
  Copy,
  Check,
  Upload,
  Eye,
  Sparkles,
  Share2,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/Chip';
import { Dialog } from '../../components/ui/Dialog';
import { CredentialCard } from '../../components/credential/CredentialCard';
import { useToast } from '../../components/ui/Toast';
import {
  hasStoredVault,
  isVaultUnlocked,
  createNewVault,
  unlockStoredVault,
  lockVault,
  getUnlockedVault,
  addCredentialToVault,
  removeCredentialFromVault,
  VaultData,
  StoredCredential,
} from '../../lib/vault';
import { decryptStoredDocument } from '../../lib/prover';
import { resolveIssuerPublicKey } from '../../lib/keys';
import { api } from '../../lib/api-client';
import { CredentialPackage, verifyUniversityDegreeCredential, createVerifierEphemeralShare } from '@zk-docguard/core';

export default function WalletPage() {
  const { showToast } = useToast();
  const [hasVault, setHasVault] = useState<boolean>(false);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);

  // Form states for onboarding & unlock
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDid, setCopiedDid] = useState(false);

  // Modals & drawers
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importDocKey, setImportDocKey] = useState('');
  const [selectedCred, setSelectedCred] = useState<StoredCredential | null>(null);

  // Document decryption modal
  const [decryptedDocText, setDecryptedDocText] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  // Ephemeral document sharing modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareVerifierName, setShareVerifierName] = useState('Consulate Verification');
  const [shareVerifierPubkey, setShareVerifierPubkey] = useState('');
  const [shareTtl, setShareTtl] = useState('900');
  const [shareLinkResult, setShareLinkResult] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    const exists = hasStoredVault();
    setHasVault(exists);
    if (isVaultUnlocked()) {
      try {
        const data = getUnlockedVault();
        setVaultData(data);
        setUnlocked(true);
      } catch {
        setUnlocked(false);
      }
    }
  }, []);

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) {
      showToast('Master passphrase must be at least 8 characters', 'error');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      showToast('Passphrases do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      const { vault } = await createNewVault(passphrase);
      setVaultData(vault);
      setHasVault(true);
      setUnlocked(true);
      setPassphrase('');
      setConfirmPassphrase('');
      showToast('Holder vault and gasless DID initialized securely', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create vault', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await unlockStoredVault(passphrase);
      setVaultData(data);
      setUnlocked(true);
      setPassphrase('');
      showToast('Holder vault unlocked', 'success');
    } catch {
      showToast('Incorrect passphrase. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLockWallet = () => {
    lockVault();
    setUnlocked(false);
    setVaultData(null);
    setSelectedCred(null);
    showToast('Holder vault locked', 'info');
  };

  const handleCopyDid = () => {
    if (!vaultData) return;
    navigator.clipboard.writeText(vaultData.identity.did);
    setCopiedDid(true);
    setTimeout(() => setCopiedDid(false), 2000);
    showToast('Copied DID to clipboard', 'info');
  };

  const handleImportCredential = async () => {
    if (!importJsonText.trim()) {
      showToast('Please paste a valid credential JSON package', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText);
      // Validate whether it is a CredentialPackage or a raw VC
      const pkg: CredentialPackage = parsed.vc && parsed.rawValues
        ? parsed
        : {
            vc: parsed,
            rawValues: parsed.proof?.rawValues || [],
            salts: parsed.proof?.salts || [],
            documentKeyHex: importDocKey || parsed.documentKeyHex,
          };

      // Verify cryptographic validity
      const issuerPublicKey = await resolveIssuerPublicKey(pkg.vc.issuer, pkg);
      const verifyRes = await verifyUniversityDegreeCredential(pkg.vc, { issuerPublicKey });
      if (!verifyRes.isValid) {
        showToast(`Warning: Credential failed cryptographic verification: ${verifyRes.error}`, 'warning');
      }

      await addCredentialToVault(pkg, {
        documentKeyHex: importDocKey || (pkg as unknown as { documentKeyHex?: string }).documentKeyHex,
      });

      const updated = getUnlockedVault();
      setVaultData(updated);
      setImportModalOpen(false);
      setImportJsonText('');
      setImportDocKey('');
      showToast('Credential imported into secure vault successfully', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Invalid JSON package', 'error');
    }
  };

  const handleDecryptDocument = async (cred: StoredCredential) => {
    setDecrypting(true);
    setDecryptedDocText(null);

    try {
      const cid = String(cred.pkg.vc.credentialSubject.documentCID || '');
      if (!cid) {
        throw new Error('Credential does not have an attached IPFS document CID');
      }

      // Fetch ciphertext from API or IPFS
      const ipfsRes = await api.ipfs.get(cid);
      const decryptedBytes = await decryptStoredDocument(cred, ipfsRes.ciphertext);
      const text = new TextDecoder().decode(decryptedBytes);
      setDecryptedDocText(text);
      showToast('Document decrypted client-side with AES-256-GCM', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Decryption failed', 'error');
    } finally {
      setDecrypting(false);
    }
  };

  const handleCreateShare = async () => {
    if (!selectedCred) {
      showToast('No credential selected', 'error');
      return;
    }
    const cleanPubkey = shareVerifierPubkey.trim().replace(/^0x/, '');
    if (cleanPubkey.length !== 64) {
      showToast('Verifier ephemeral public key must be 64 hex characters (32 bytes)', 'error');
      return;
    }
    setShareLoading(true);
    try {
      const rawHex = selectedCred.documentKeyHex || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const cleanKey = rawHex.replace(/^0x/, '');
      const docKeyBytes = new Uint8Array(cleanKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const verifierPubBytes = new Uint8Array(cleanPubkey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      const ttl = parseInt(shareTtl, 10) || 900;

      const wrappedShare = await createVerifierEphemeralShare(docKeyBytes, verifierPubBytes, ttl);
      const cid = String(selectedCred.pkg.vc.credentialSubject.documentCID || 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');

      const linkRes = await api.sharing.createLink({
        cid,
        verifierPublicKey: cleanPubkey,
        verifierName: shareVerifierName.trim() || 'Direct Verifier',
        ttlSeconds: ttl,
      });

      await api.sharing.fulfillLink(linkRes.linkId, wrappedShare as unknown as Record<string, unknown>);
      setShareLinkResult(linkRes.linkId);
      showToast('Ephemeral document share package created and fulfilled!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create share package', 'error');
    } finally {
      setShareLoading(false);
    }
  };

  // State 1: No vault created yet -> Onboarding
  if (!hasVault) {
    return (
      <div className="app-container" style={{ padding: '3rem 1.5rem', maxWidth: '640px' }}>
        <Card
          title="Create Holder Identity Wallet"
          subtitle="Gasless self-sovereign identity with encrypted client-side storage"
        >
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              ZK-DocGuard stores your academic credentials, cryptographic secrets, and selective disclosure
              proving keys inside your browser using <strong>PBKDF2 (600,000 iterations)</strong> and <strong>AES-256-GCM</strong>.
              Your plaintext identity and documents never touch a centralized server.
            </p>
          </div>

          <form onSubmit={handleCreateWallet} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Master Vault Passphrase"
              type="password"
              placeholder="Minimum 8 characters"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
            <Input
              label="Confirm Passphrase"
              type="password"
              placeholder="Re-enter passphrase"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
                <KeyRound size={16} />
                Initialize Secure Wallet
              </Button>
              <Link href="/wallet/backup" style={{ textDecoration: 'none' }}>
                <Button type="button" variant="outline">
                  <Upload size={16} />
                  Restore Backup
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // State 2: Vault exists but is locked
  if (!unlocked) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', maxWidth: '520px' }}>
        <Card
          title="Unlock Holder Identity Vault"
          subtitle="Enter your master passphrase to access stored credentials and generate proofs"
        >
          <form onSubmit={handleUnlockWallet} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Master Passphrase"
              type="password"
              placeholder="Enter master passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
                <Unlock size={16} />
                Unlock Vault
              </Button>
              <Link href="/wallet/backup" style={{ textDecoration: 'none' }}>
                <Button type="button" variant="outline">
                  Restore Backup
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // State 3: Vault is unlocked
  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem' }}>
      {/* Top Identity Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.375rem',
            }}
          >
            Holder Identity Wallet
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>DID:</span>
            <Chip
              variant="outline"
              label={vaultData ? vaultData.identity.did : ''}
              truncateLength={28}
            />
            <button
              onClick={handleCopyDid}
              title="Copy DID"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copiedDid ? 'var(--color-success)' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {copiedDid ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <Chip
              variant="success"
              label={`${vaultData?.credentials.length || 0} Credentials Held`}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <Upload size={14} />
            Import Credential
          </Button>
          <Link href="/wallet/present" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              <Sparkles size={14} />
              Present ZK Proof
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLockWallet} title="Lock Vault">
            <Lock size={14} />
            Lock
          </Button>
        </div>
      </div>

      {/* Main Grid: Credentials List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {vaultData && vaultData.credentials.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Card>
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  No Credentials in Wallet
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                  Your secure vault is ready. Import an official W3C Verifiable Credential issued by an accredited institution.
                </p>
                <Button variant="primary" onClick={() => setImportModalOpen(true)}>
                  <Upload size={16} />
                  Import Credential Package
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          vaultData?.credentials.map((cred) => (
            <Card
              key={cred.id}
              title={cred.degreeTitle}
              subtitle={`Issued by ${cred.issuerDid.slice(0, 24)}...`}
              headerAction={
                <Chip variant="success" label="Active" />
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Student Name:</span>
                  <span style={{ fontWeight: 500 }}>{cred.studentName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Issuance Date:</span>
                  <span>{new Date(cred.issuedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Document Hash:</span>
                  <Chip variant="outline" label={cred.docHash} truncateLength={16} />
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: '0.5rem',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSelectedCred(cred);
                      setDecryptedDocText(null);
                    }}
                  >
                    <Eye size={14} />
                    Inspect Details
                  </Button>
                  <Link href={`/wallet/present?credId=${cred.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                    <Button variant="primary" size="sm" style={{ width: '100%' }}>
                      <Sparkles size={14} />
                      Present Proof
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Import Modal */}
      <Dialog
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Credential Package"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Paste the W3C Verifiable Credential JSON package exported from the issuer console.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Credential Package JSON:
            </label>
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON delivery package..."
              style={{
                width: '100%',
                padding: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <Input
            label="Document Decryption Key (Optional Hex)"
            placeholder="0x..."
            value={importDocKey}
            onChange={(e) => setImportDocKey(e.target.value)}
            helperText="Provided by issuer for client-side AES-256-GCM document unwrapping"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImportCredential}>
              <Upload size={16} />
              Import to Vault
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Credential Detail Modal */}
      {selectedCred && (
        <Dialog
          isOpen={Boolean(selectedCred)}
          onClose={() => setSelectedCred(null)}
          title="Credential Cryptographic Details"
          maxWidth="720px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Double-frame CredentialCard */}
            <CredentialCard
              credential={{
                credentialId: selectedCred.id,
                docHash: selectedCred.docHash,
                schemaId: selectedCred.schemaId,
                degreeName: selectedCred.degreeTitle,
                programName: 'Computer Science & Engineering',
                institutionName: 'Northfield State University',
                issuerDid: selectedCred.issuerDid,
                holderName: selectedCred.studentName,
                studentId: String(selectedCred.pkg.vc.credentialSubject.studentId || 'STUDENT-2022-042'),
                graduationYear: Number(selectedCred.pkg.vc.credentialSubject.graduationYear || 2026),
                cgpa: '3.75',
                issuedAt: selectedCred.issuedAt,
                status: 'Valid',
                cid: String(selectedCred.pkg.vc.credentialSubject.documentCID || ''),
              }}
            />

            {/* Cryptographic Parameters */}
            <Card title="8-Slot Commitment Tree & Proofs">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>BabyJubJub EdDSA Signature:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    R8x: {selectedCred.pkg.vc.proof.signature.R8x.slice(0, 16)}... | S: {selectedCred.pkg.vc.proof.signature.S.slice(0, 16)}...
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Merkle Tree Root:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {selectedCred.pkg.vc.proof.credentialRoot?.slice(0, 24)}...
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>IPFS Ciphertext CID:</span>
                  <Chip variant="outline" label={String(selectedCred.pkg.vc.credentialSubject.documentCID || 'None')} />
                </div>
              </div>
            </Card>

            {/* Decrypt Attachment Section */}
            <Card title="Client-Side Document Attachment">
              {decryptedDocText ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>
                      Verified Decrypted Plaintext
                    </span>
                  </div>
                  <pre
                    style={{
                      padding: '1rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {decryptedDocText}
                  </pre>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Document ciphertext stored on IPFS. Decrypt locally or generate a time-limited ephemeral share for a verifier.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={decrypting}
                      onClick={() => handleDecryptDocument(selectedCred)}
                    >
                      <Lock size={14} />
                      Decrypt Attachment
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShareModalOpen(true);
                        setShareLinkResult(null);
                      }}
                    >
                      <Share2 size={14} />
                      Share Ephemeral Copy
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this credential from your vault?')) {
                    await removeCredentialFromVault(selectedCred.id);
                    setVaultData(getUnlockedVault());
                    setSelectedCred(null);
                    showToast('Credential removed', 'info');
                  }
                }}
              >
                Delete from Vault
              </Button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" size="sm" onClick={() => setSelectedCred(null)}>
                  Close
                </Button>
                <Link href={`/wallet/present?credId=${selectedCred.id}`} style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="sm">
                    <Sparkles size={14} />
                    Create ZK Presentation
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Ephemeral Document Sharing Modal */}
      <Dialog
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Verifier-Scoped Ephemeral Document Share"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Re-encrypts the document key specifically for the verifier&apos;s ephemeral X25519 public key.
            The sharing package expires automatically after the specified time-to-live.
          </p>

          <Input
            label="Verifier / Institution Name"
            placeholder="e.g. Consulate Visa Division"
            value={shareVerifierName}
            onChange={(e) => setShareVerifierName(e.target.value)}
          />

          <Input
            label="Verifier Ephemeral X25519 Public Key (64-char Hex)"
            placeholder="e.g. aabbcc... 32 bytes hex"
            value={shareVerifierPubkey}
            onChange={(e) => setShareVerifierPubkey(e.target.value)}
            helperText="Provided by verifier or generated in Verifier Request Studio"
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Expiration Time-To-Live (TTL)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: '15 Minutes', val: '900' },
                { label: '1 Hour', val: '3600' },
                { label: '24 Hours', val: '86400' },
              ].map((opt) => (
                <Button
                  key={opt.val}
                  type="button"
                  variant={shareTtl === opt.val ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setShareTtl(opt.val)}
                >
                  <Clock size={14} />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {shareLinkResult && (
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-success)' }}>
                  Share Package Activated
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLinkResult);
                    setCopiedShareLink(true);
                    setTimeout(() => setCopiedShareLink(false), 2000);
                  }}
                >
                  {copiedShareLink ? <Check size={14} /> : <Copy size={14} />}
                  {copiedShareLink ? 'Copied' : 'Copy Share ID'}
                </Button>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                {shareLinkResult}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button variant="outline" onClick={() => setShareModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              loading={shareLoading}
              onClick={handleCreateShare}
            >
              <Share2 size={16} />
              Re-wrap & Activate Share
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
