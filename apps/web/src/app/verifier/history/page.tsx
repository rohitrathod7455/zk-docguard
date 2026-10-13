'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Chip } from '../../../components/ui/Chip';
import { Dialog } from '../../../components/ui/Dialog';
import { useToast } from '../../../components/ui/Toast';
import { api } from '../../../lib/api-client';

interface SessionItem {
  sessionId: string;
  verifierName: string;
  domain: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  challenge: string;
  expiresAt: string;
  createdAt: string;
  request: {
    revealMask?: boolean[];
    requiredAttributes?: number[];
    requiredPredicates?: Array<{ index: number; minThreshold: number }>;
    trustedIssuerKeyHashes?: string[];
  };
  result?: Record<string, unknown> | null;
}

export default function VerifierHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected session for inspection dialog
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);

  useEffect(() => {
    async function loadSessions() {
      setLoading(true);
      try {
        const filterParam = statusFilter === 'ALL' ? undefined : statusFilter;
        const res = await api.sessions.getAll({ status: filterParam, limit: 100 });
        setSessions(res.sessions || []);
        setTotal(res.total || 0);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    }

    loadSessions();
  }, [statusFilter, toast]);

  const filtered = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.sessionId.toLowerCase().includes(q) ||
      s.verifierName.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'VERIFIED':
        return (
          <Badge variant="valid">
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Verified
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="pending">
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B', marginRight: '6px' }} />
            Pending
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="revoked">
            <AlertTriangle size={12} style={{ marginRight: '4px' }} /> Rejected
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="neutral">
            <Clock size={12} style={{ marginRight: '4px' }} /> Expired
          </Badge>
        );
      default:
        return <Badge variant="neutral">{st}</Badge>;
    }
  };

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1080px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-text)',
              }}
            >
              <History size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
              Verification Session Log
            </h1>
            <Badge variant="neutral">{total} Total</Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>
            Audit trail of all zero-knowledge presentations requested and verified across sessions.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => router.push('/verifier')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          New Verification Request
          <ArrowRight size={16} />
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['ALL', 'VERIFIED', 'PENDING', 'REJECTED', 'EXPIRED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                padding: '0.375rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: statusFilter === filter ? 'var(--accent-default)' : 'var(--border-default)',
                background: statusFilter === filter ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                color: statusFilter === filter ? 'var(--accent-text)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {filter === 'ALL' ? 'All Sessions' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div style={{ minWidth: '260px' }}>
          <Input
            placeholder="Search by session ID or verifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Session Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading session records...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No verification sessions found matching criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '0.875rem 1.25rem' }}>Session ID</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Verifier / Domain</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Requested Claims</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Created At</th>
                  <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.sessionId}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {item.sessionId.slice(0, 8)}...
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.verifierName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.domain}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>{getStatusBadge(item.status)}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {item.request.requiredPredicates?.length ? (
                          <Chip variant="info">
                            {item.request.requiredPredicates.length} Predicates
                          </Chip>
                        ) : null}
                        {item.request.requiredAttributes?.length ? (
                          <Chip variant="neutral">
                            {item.request.requiredAttributes.length} Attributes
                          </Chip>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedSession(item)}
                          title="Inspect Session"
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/verifier/session/${item.sessionId}`)}
                        >
                          Open
                        </Button>
                        {item.status === 'VERIFIED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => router.push(`/verifier/receipt/${item.sessionId}`)}
                            title="Print Receipt"
                          >
                            <Printer size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Inspect Session Dialog */}
      {selectedSession && (
        <Dialog
          isOpen={Boolean(selectedSession)}
          onClose={() => setSelectedSession(null)}
          title="Verification Session Detail"
          description={`Session ID: ${selectedSession.sessionId}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Verifier Name
                </div>
                <div style={{ fontWeight: 500 }}>{selectedSession.verifierName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Domain
                </div>
                <div style={{ fontWeight: 500 }}>{selectedSession.domain}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Status
                </div>
                <div>{getStatusBadge(selectedSession.status)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Expires At
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {new Date(selectedSession.expiresAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Poseidon Challenge Nonce
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  wordBreak: 'break-all',
                }}
              >
                {selectedSession.challenge}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedSession(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const id = selectedSession.sessionId;
                  setSelectedSession(null);
                  router.push(`/verifier/session/${id}`);
                }}
              >
                Go to Live Screen
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
