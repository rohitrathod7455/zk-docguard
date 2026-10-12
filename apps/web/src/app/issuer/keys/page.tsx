'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Chip } from '../../../components/ui/Chip';
import { useToast } from '../../../components/ui/Toast';
import { useWallet } from '../../../components/auth/WalletContext';
import {
  getOrDeriveIssuerKey,
  rotateIssuerKey,
  StoredIssuerKey,
} from '../../../lib/keys';
import { checkIsActiveKey } from '../../../lib/contracts';
import { ArrowLeft, KeyRound, RefreshCw, ShieldCheck, Download, Eye, EyeOff } from 'lucide-react';

export default function IssuerKeysPage() {
  const { address } = useWallet();
  const effectiveAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const { showToast } = useToast();

  const [keyData, setKeyData] = useState<StoredIssuerKey | null>(null);
  const [isActiveOnChain, setIsActiveOnChain] = useState<boolean>(true);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [rotating, setRotating] = useState<boolean>(false);

  const loadKeys = async () => {
    try {
      const stored = await getOrDeriveIssuerKey(effectiveAddress);
      setKeyData(stored);

      const active = await checkIsActiveKey(stored.keyHashHex as `0x${string}`);
      setIsActiveOnChain(active);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load cryptographic keys');
    }
  };

  useEffect(() => {
    loadKeys();
  }, [effectiveAddress]);

  const handleRotate = async () => {
    if (!keyData) return;
    setRotating(true);
    try {
      const nextKey = await rotateIssuerKey(effectiveAddress, keyData.epoch);
      setKeyData(nextKey);
      showToast(
        'success',
        `Proving key rotated to Epoch ${nextKey.epoch}. Previous key entered 90-day grace period.`,
      );
    } catch {
      showToast('error', 'Key rotation failed');
    } finally {
      setRotating(false);
    }
  };

  const handleExport = () => {
    if (!keyData) return;
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zk-docguard-issuer-key-epoch-${keyData.epoch}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('info', 'Key parameters backup downloaded');
  };

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/issuer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            textDecoration: 'none',
            marginBottom: '0.75rem',
          }}
        >
          <ArrowLeft size={14} /> Back to Issuer Console
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 0, fontWeight: 500 }}>
              BabyJubJub Key & DID Management
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Deterministic EdDSA proving keys for Groth16 circuit signature verification in Circom
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!keyData}>
              <Download size={14} style={{ marginRight: '0.375rem' }} /> Export Key Backup
            </Button>
            <Button variant="primary" size="sm" onClick={handleRotate} loading={rotating}>
              <RefreshCw size={14} style={{ marginRight: '0.375rem' }} /> Rotate Key to Epoch {(keyData?.epoch || 1) + 1}
            </Button>
          </div>
        </div>
      </div>

      {keyData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Key Overview Card */}
          <Card
            title={`Active Proving Key — Epoch ${keyData.epoch}`}
            subtitle="Derived via HKDF-SHA256 from institutional registrar identity"
            headerAction={
              <Badge variant={isActiveOnChain ? 'valid' : 'pending'}>
                <ShieldCheck size={12} style={{ marginRight: '0.25rem' }} />
                {isActiveOnChain ? 'Active On-Chain' : 'Pending Anchoring'}
              </Badge>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem', fontWeight: 600 }}>
                  W3C Decentralized Identifier (DID)
                </label>
                <Chip value={`did:ethr:31337:${effectiveAddress}`} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem', fontWeight: 600 }}>
                  Issuer Proving Key Hash (Poseidon(Ax, Ay))
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Chip value={keyData.keyHashHex} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Constrained in circuit signal <code>issuerKeyHash</code>
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem', fontWeight: 600 }}>
                    BabyJubJub Curve Point Ax
                  </label>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {keyData.publicKey.x}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem', fontWeight: 600 }}>
                    BabyJubJub Curve Point Ay
                  </label>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {keyData.publicKey.y}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Private Proving Key Entropy
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-text)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {showPrivateKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPrivateKey ? 'Hide Key' : 'Reveal Key'}
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    background: 'var(--bg-surface-elevated)',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius)',
                    color: showPrivateKey ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {showPrivateKey
                    ? `0x${keyData.privateKeyHex}`
                    : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                </div>
              </div>
            </div>
          </Card>

          {/* Smart Contract Grace Period Architecture */}
          <Card
            title="Cryptographic Key Lifecycle & Grace Period Architecture"
            subtitle="Security guarantees enforced by IssuerRegistry.sol"
          >
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                When you rotate to a new proving key, <code>IssuerRegistry.sol</code> updates the active key hash and
                initiates an immutable <strong>90-day grace period</strong> for the previous epoch. Credentials previously
                issued under Epoch {keyData.epoch} remain valid during the grace period, preventing service interruption for graduates.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <KeyRound size={20} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.8125rem' }}>
                  <strong>Key Rotation Guarantee:</strong> Old keys cannot issue new credentials, but Groth16 proofs
                  generated for previously conferred degrees verify cleanly against on-chain status checks.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
