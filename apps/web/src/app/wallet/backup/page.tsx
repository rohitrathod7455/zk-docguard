'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  ShieldAlert,
  Check,
  Copy,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import {
  isVaultUnlocked,
  getUnlockedVault,
  exportVaultBackup,
  importVaultBackup,
  wipeLocalVault,
  VaultData,
} from '../../../lib/vault';

export default function BackupPage() {
  const { showToast } = useToast();
  const [unlocked, setUnlocked] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);

  // Export states
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exporting, setExporting] = useState(false);

  // Import states
  const [importJson, setImportJson] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importing, setImporting] = useState(false);

  // Key inspection
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isVaultUnlocked()) {
      setUnlocked(true);
      setVaultData(getUnlockedVault());
    }
  }, []);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backupStr = await exportVaultBackup(exportPassphrase || undefined);
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zk-docguard-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportPassphrase('');
      showToast('Encrypted backup exported successfully', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJson.trim()) {
      showToast('Please paste backup JSON', 'error');
      return;
    }
    if (!importPassphrase) {
      showToast('Please enter the backup passphrase', 'error');
      return;
    }

    setImporting(true);
    try {
      const restored = await importVaultBackup(importJson, importPassphrase);
      setVaultData(restored);
      setUnlocked(true);
      setImportJson('');
      setImportPassphrase('');
      showToast('Vault restored and unlocked successfully', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to decrypt backup', 'error');
    } finally {
      setImporting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`Copied ${label}`, 'info');
  };

  const handleWipeVault = () => {
    if (confirm('CRITICAL WARNING: This will permanently delete your stored vault, keys, and credentials from this browser. Make sure you have exported a backup. Proceed?')) {
      wipeLocalVault();
      setUnlocked(false);
      setVaultData(null);
      showToast('Vault wiped completely from local storage', 'info');
    }
  };

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem', maxWidth: '840px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem',
            fontWeight: 600,
            marginBottom: '0.375rem',
          }}
        >
          Vault Backup & Cryptographic Security
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Export encrypted archives, restore your wallet, or inspect your Self-Sovereign Identity parameters.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Export Backup Section */}
        {unlocked && (
          <Card
            title="Export Encrypted Vault Archive"
            subtitle="PBKDF2 (600,000 iterations) + AES-256-GCM encrypted backup containing all credentials & keys"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Your exported file is an encrypted envelope. You can safely store it on offline media or cloud storage.
                You will need your passphrase to restore it.
              </p>
              <Input
                label="Confirm Master Passphrase for Export (Optional)"
                type="password"
                placeholder="Leave blank to use active session passphrase"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
              />
              <div>
                <Button variant="primary" loading={exporting} onClick={handleExportBackup}>
                  <Download size={16} />
                  Download Encrypted Backup (.json)
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Import Backup Section */}
        <Card
          title="Restore Vault from Backup"
          subtitle="Import an encrypted backup JSON file and unlock with its master passphrase"
        >
          <form onSubmit={handleImportBackup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem' }}>
                Encrypted Backup JSON:
              </label>
              <textarea
                rows={6}
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste encrypted vault envelope JSON..."
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
              label="Backup Passphrase"
              type="password"
              placeholder="Passphrase used when exporting"
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
              required
            />
            <div>
              <Button type="submit" variant="primary" loading={importing}>
                <Upload size={16} />
                Decrypt & Restore Vault
              </Button>
            </div>
          </form>
        </Card>

        {/* Cryptographic Identity Parameters */}
        {unlocked && vaultData && (
          <Card title="Cryptographic Identity Parameters" subtitle="Self-Sovereign Identity keys & BN254 commitments">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8125rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>Holder DID (W3C did:key):</span>
                  <button
                    onClick={() => copyToClipboard(vaultData.identity.did, 'DID')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    {copiedKey === 'DID' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <pre style={{ padding: '0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
                  {vaultData.identity.did}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>Poseidon Holder Secret Field (Slot 0 Preimage):</span>
                  <button
                    onClick={() => copyToClipboard(vaultData.identity.holderSecretField, 'Holder Secret')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    {copiedKey === 'Holder Secret' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <pre style={{ padding: '0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
                  {vaultData.identity.holderSecretField}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600 }}>X25519 Public Key (Document Key Agreement):</span>
                  <button
                    onClick={() => copyToClipboard(vaultData.identity.x25519PublicKeyHex, 'X25519 Key')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    {copiedKey === 'X25519 Key' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <pre style={{ padding: '0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
                  {vaultData.identity.x25519PublicKeyHex}
                </pre>
              </div>
            </div>
          </Card>
        )}

        {/* Danger Zone */}
        {unlocked && (
          <Card title="Danger Zone" subtitle="Irreversible local actions">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-danger, #D32F2F)' }}>
                  Wipe Local Vault
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Deletes all encrypted keys and credentials from this browser.
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={handleWipeVault}>
                <ShieldAlert size={14} />
                Wipe Vault
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
