'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { useToast } from '../../components/ui/Toast';
import { useWallet } from '../../components/auth/WalletContext';
import {
  getIssuers,
  adminApproveIssuer,
  adminSuspendIssuer,
  IssuerRecord,
} from '../../lib/api-client';
import { ShieldCheck, UserCheck, AlertTriangle, FileText, ArrowRight, RefreshCw } from 'lucide-react';

export default function AdminOverviewPage() {
  const { role, address } = useWallet();
  const { showToast } = useToast();
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAddr, setProcessingAddr] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getIssuers();
      setIssuers(data);
    } catch {
      showToast('error', 'Failed to load institutional registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (targetAddress: string) => {
    setProcessingAddr(targetAddress);
    try {
      const res = await adminApproveIssuer(targetAddress);
      if (res.ok) {
        showToast('success', `Issuer approved on-chain: ${targetAddress.slice(0, 10)}...`);
        await loadData();
      } else {
        showToast('error', res.error || 'Approval failed');
      }
    } catch {
      showToast('error', 'Network error during approval');
    } finally {
      setProcessingAddr(null);
    }
  };

  const handleSuspend = async (targetAddress: string) => {
    setProcessingAddr(targetAddress);
    try {
      const res = await adminSuspendIssuer(targetAddress);
      if (res.ok) {
        showToast('warning', `Issuer suspended: ${targetAddress.slice(0, 10)}...`);
        await loadData();
      } else {
        showToast('error', res.error || 'Suspension failed');
      }
    } catch {
      showToast('error', 'Network error during suspension');
    } finally {
      setProcessingAddr(null);
    }
  };

  const pendingCount = issuers.filter((i) => i.status === 'Pending').length;
  const activeCount = issuers.filter((i) => i.status === 'Active').length;
  const suspendedCount = issuers.filter((i) => i.status === 'Suspended').length;

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent-text)',
                fontWeight: 600,
              }}
            >
              Registry Governance Console
            </span>
            <Badge variant="accent">Administrator Role</Badge>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', margin: 0, fontWeight: 500 }}>
            Root Institutional Registry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.5rem', maxWidth: '640px' }}>
            Governs accredited university and governmental issuer identities, approves cryptographic proving key hashes,
            and maintains on-chain smart contract authority across EVM testnets.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.375rem' }} /> Refresh
          </Button>
          <Link href="/admin/issuers">
            <Button variant="primary" size="sm">
              Manage Applicants <ArrowRight size={14} style={{ marginLeft: '0.375rem' }} />
            </Button>
          </Link>
        </div>
      </div>

      {role !== 'admin' && (
        <div
          style={{
            background: 'var(--status-pending-bg)',
            border: '1px solid var(--status-pending-border)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--status-pending-text)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem', color: 'var(--status-pending-text)' }}>
            <strong>Demo Administrator Notice:</strong> You are currently viewing this governance portal as <code>{role}</code>.
            To submit live on-chain governance transactions, switch to the <strong>Registry Administrator</strong> persona in the header.
          </div>
        </div>
      )}

      {/* Metric Tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Issuers
            </span>
            <ShieldCheck size={16} style={{ color: 'var(--status-valid-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>{activeCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Authorized on-chain</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Applications
            </span>
            <UserCheck size={16} style={{ color: 'var(--status-pending-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>{pendingCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Awaiting admin review</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Suspended Issuers
            </span>
            <AlertTriangle size={16} style={{ color: 'var(--status-revoked-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>{suspendedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Keys temporarily paused</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Address
            </span>
            <FileText size={16} style={{ color: 'var(--accent-text)' }} />
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Chip value={address || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'} truncateLength={6} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>DEFAULT_ADMIN_ROLE</div>
        </Card>
      </div>

      {/* Institutional Issuers Registry Table */}
      <Card
        title="Accredited Institutions & Proving Key Hashes"
        subtitle="On-chain identity records anchored to IssuerRegistry.sol"
        style={{ overflow: 'hidden' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="hairline-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Institution Address</th>
                <th>W3C DID</th>
                <th>BabyJubJub Key Hash</th>
                <th>Key Epoch</th>
                <th>Status</th>
                <th>Registered</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issuers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No institutional issuers found in registry.
                  </td>
                </tr>
              ) : (
                issuers.map((item) => (
                  <tr key={item.address}>
                    <td>
                      <Chip value={item.address} truncateLength={6} />
                    </td>
                    <td>
                      <Chip value={item.did} truncateLength={10} />
                    </td>
                    <td>
                      <Chip value={item.zkKeyHash} truncateLength={8} />
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        Epoch {item.keyEpoch}
                      </span>
                    </td>
                    <td>
                      <Badge
                        variant={
                          item.status === 'Active'
                            ? 'valid'
                            : item.status === 'Pending'
                            ? 'pending'
                            : 'revoked'
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {new Date(item.registeredAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {item.status === 'Pending' && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={processingAddr === item.address}
                            onClick={() => handleApprove(item.address)}
                          >
                            Approve
                          </Button>
                        )}
                        {item.status === 'Active' && (
                          <Button
                            size="sm"
                            variant="danger"
                            loading={processingAddr === item.address}
                            onClick={() => handleSuspend(item.address)}
                          >
                            Suspend
                          </Button>
                        )}
                        {item.status === 'Suspended' && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={processingAddr === item.address}
                            onClick={() => handleApprove(item.address)}
                          >
                            Reinstate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
