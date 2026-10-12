'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Chip } from '../../../components/ui/Chip';
import { Tabs } from '../../../components/ui/Tabs';
import { useToast } from '../../../components/ui/Toast';
import { getIssuers, adminApproveIssuer, adminSuspendIssuer, IssuerRecord } from '../../../lib/api-client';
import { ArrowLeft, RefreshCw, CheckCircle, Ban, ExternalLink, ShieldCheck } from 'lucide-react';

export default function AdminIssuersPage() {
  const { showToast } = useToast();
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [loading, setLoading] = useState(true);
  const [processingAddr, setProcessingAddr] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getIssuers();
      setIssuers(data);
    } catch {
      showToast('error', 'Failed to retrieve applicants');
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
      showToast('error', 'Error approving issuer');
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
      showToast('error', 'Error suspending issuer');
    } finally {
      setProcessingAddr(null);
    }
  };

  const filteredIssuers = issuers.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return item.status === 'Pending';
    if (activeTab === 'active') return item.status === 'Active';
    if (activeTab === 'suspended') return item.status === 'Suspended';
    return true;
  });

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/admin"
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
          <ArrowLeft size={14} /> Back to Registry Overview
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 0, fontWeight: 500 }}>
              Institutional Applicants Review
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Approve, audit, or suspend educational and governmental institutions in IssuerRegistry.sol
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} style={{ marginRight: '0.375rem' }} /> Refresh Records
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <Tabs
          tabs={[
            { id: 'all', label: `All Issuers (${issuers.length})` },
            { id: 'pending', label: `Pending Review (${issuers.filter((i) => i.status === 'Pending').length})` },
            { id: 'active', label: `Active (${issuers.filter((i) => i.status === 'Active').length})` },
            { id: 'suspended', label: `Suspended (${issuers.filter((i) => i.status === 'Suspended').length})` },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
        />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hairline-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Legal Entity & Address</th>
              <th>DID Identifier</th>
              <th>BabyJubJub Key Hash</th>
              <th>Metadata URI</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Governance Decision</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssuers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No applicants match the selected status filter.
                </td>
              </tr>
            ) : (
              filteredIssuers.map((item) => (
                <tr key={item.address}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldCheck size={16} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {item.address.toLowerCase() === '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
                            ? 'Northfield University Registrar'
                            : 'Accredited Institution'}
                        </div>
                        <Chip value={item.address} truncateLength={6} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <Chip value={item.did} truncateLength={10} />
                  </td>
                  <td>
                    <Chip value={item.zkKeyHash} truncateLength={8} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.metadataURI.slice(0, 22)}...
                      </span>
                      <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                    </div>
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
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      {item.status === 'Pending' && (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={processingAddr === item.address}
                          onClick={() => handleApprove(item.address)}
                        >
                          <CheckCircle size={13} style={{ marginRight: '0.25rem' }} /> Approve On-Chain
                        </Button>
                      )}
                      {item.status === 'Active' && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={processingAddr === item.address}
                          onClick={() => handleSuspend(item.address)}
                        >
                          <Ban size={13} style={{ marginRight: '0.25rem' }} /> Suspend
                        </Button>
                      )}
                      {item.status === 'Suspended' && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={processingAddr === item.address}
                          onClick={() => handleApprove(item.address)}
                        >
                          <CheckCircle size={13} style={{ marginRight: '0.25rem' }} /> Reinstate
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
    </div>
  );
}
