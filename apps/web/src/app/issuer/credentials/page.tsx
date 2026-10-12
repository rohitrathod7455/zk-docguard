'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Chip } from '../../../components/ui/Chip';
import { Tabs } from '../../../components/ui/Tabs';
import { Dialog } from '../../../components/ui/Dialog';
import { useToast } from '../../../components/ui/Toast';
import { useWallet } from '../../../components/auth/WalletContext';
import { getCredentials, recordRevocation, CredentialRecordDto } from '../../../lib/api-client';
import { getOrDeriveIssuerKey } from '../../../lib/keys';
import {
  ArrowLeft,
  RefreshCw,
  Ban,
  FileText,
  ShieldAlert,
  Search,
} from 'lucide-react';

export default function IssuerCredentialsPage() {
  const { address } = useWallet();
  const effectiveAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const { showToast } = useToast();

  const [credentials, setCredentials] = useState<CredentialRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'revoked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCred, setSelectedCred] = useState<CredentialRecordDto | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { records } = await getCredentials({ issuerAddress: effectiveAddress });
      setCredentials(records);
    } catch {
      showToast('error', 'Failed to retrieve credentials registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveAddress]);

  const handleRevoke = async (cred: CredentialRecordDto) => {
    setRevokingId(cred.credentialId);
    try {
      const storedKey = await getOrDeriveIssuerKey(effectiveAddress);
      const res = await recordRevocation({
        credentialId: cred.credentialId,
        issuerKeyHash: storedKey.keyHashHex,
        reasonCode: 'ACADEMIC_MISCONDUCT_OR_CORRECTION',
      });

      if (res.ok) {
        showToast('warning', `Credential ${cred.credentialId.slice(0, 10)}... revoked on-chain & SMT updated`);
        // Update local status
        setCredentials((prev) =>
          prev.map((c) => (c.credentialId === cred.credentialId ? { ...c, status: 'Revoked' } : c)),
        );
        if (selectedCred?.credentialId === cred.credentialId) {
          setSelectedCred((prev) => (prev ? { ...prev, status: 'Revoked' } : null));
        }
      } else {
        showToast('error', res.error || 'Revocation failed');
      }
    } catch {
      showToast('error', 'Error submitting revocation transaction');
    } finally {
      setRevokingId(null);
    }
  };

  const filtered = credentials.filter((c) => {
    if (activeTab === 'valid' && c.status !== 'Valid') return false;
    if (activeTab === 'revoked' && c.status !== 'Revoked') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.docHash.toLowerCase().includes(q) ||
        c.credentialId.toLowerCase().includes(q) ||
        c.cid.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
              Issued Credentials & Revocation Ledger
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Query all academic credentials anchored to DocumentRegistry.sol and manage on-chain status & SMT roots.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.375rem' }} /> Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <Tabs
          tabs={[
            { id: 'all', label: `All Credentials (${credentials.length})` },
            { id: 'valid', label: `Valid & Active (${credentials.filter((c) => c.status === 'Valid').length})` },
            { id: 'revoked', label: `Revoked (${credentials.filter((c) => c.status === 'Revoked').length})` },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
        />

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by hash, ID, or CID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4375rem 0.75rem 0.4375rem 2rem',
              fontSize: '0.8125rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Registry Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hairline-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Document Hash (keccak256)</th>
              <th>Credential ID (Poseidon)</th>
              <th>IPFS Ciphertext CID</th>
              <th>Status</th>
              <th>Conferred Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  No credentials found in institutional registry.
                </td>
              </tr>
            ) : (
              filtered.map((cred) => (
                <tr key={cred.docHash}>
                  <td>
                    <Chip value={cred.docHash} truncateLength={6} />
                  </td>
                  <td>
                    <Chip value={cred.credentialId} truncateLength={6} />
                  </td>
                  <td>
                    <Chip value={cred.cid} truncateLength={8} />
                  </td>
                  <td>
                    <Badge variant={cred.status === 'Valid' ? 'valid' : 'revoked'}>
                      {cred.status}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {new Date(cred.issuedAt).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <Button size="sm" variant="outline" onClick={() => setSelectedCred(cred)}>
                        <FileText size={13} style={{ marginRight: '0.25rem' }} /> Inspect
                      </Button>
                      {cred.status === 'Valid' && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={revokingId === cred.credentialId}
                          onClick={() => handleRevoke(cred)}
                        >
                          <Ban size={13} style={{ marginRight: '0.25rem' }} /> Revoke
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Detail Inspection Dialog */}
      {selectedCred && (
        <Dialog
          isOpen={Boolean(selectedCred)}
          onClose={() => setSelectedCred(null)}
          title="On-Chain Credential Record Inspection"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.875rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                On-Chain Status
              </div>
              <Badge variant={selectedCred.status === 'Valid' ? 'valid' : 'revoked'}>
                {selectedCred.status}
              </Badge>
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Document Hash
              </div>
              <Chip value={selectedCred.docHash} />
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Domain-Separated Credential ID (Mode A Target)
              </div>
              <Chip value={selectedCred.credentialId} />
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                IPFS Ciphertext Multihash CID
              </div>
              <Chip value={selectedCred.cid} />
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Anchored Transaction Hash
              </div>
              <Chip value={selectedCred.txHash || '0x71a2...98c4'} />
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <ShieldAlert size={16} style={{ color: 'var(--accent-text)' }} />
              <div>
                <strong>Revocation Semantics:</strong> Revoking this credential invalidates both Mode A on-chain checks
                and causes Mode B SMT non-membership witness requests to be rejected with HTTP 409 Conflict.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              {selectedCred.status === 'Valid' && (
                <Button
                  variant="danger"
                  loading={revokingId === selectedCred.credentialId}
                  onClick={() => handleRevoke(selectedCred)}
                >
                  <Ban size={14} style={{ marginRight: '0.375rem' }} /> Execute On-Chain Revocation
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedCred(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
