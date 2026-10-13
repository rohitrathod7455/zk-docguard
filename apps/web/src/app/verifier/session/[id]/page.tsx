'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Clock,
  ExternalLink,
  Copy,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Chip } from '../../../../components/ui/Chip';
import { QRCodeDisplay } from '../../../../components/ui/QRCodeDisplay';
import { VerificationReceipt, VerificationReceiptData } from '../../../../components/verification/VerificationReceipt';
import { useToast } from '../../../../components/ui/Toast';
import { api, API_BASE_URL } from '../../../../lib/api-client';

interface SessionData {
  sessionId: string;
  verifierName: string;
  domain: string;
  challenge: string;
  nonce: string;
  request: {
    revealMask?: boolean[];
    requiredAttributes?: number[];
    requiredPredicates?: Array<{ index: number; minThreshold: number }>;
    trustedIssuerKeyHashes?: string[];
  };
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  expiresAt: string;
  result?: VerificationReceiptData | null;
}

export default function VerifierSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED'>('PENDING');
  const [receipt, setReceipt] = useState<VerificationReceiptData | null>(null);
  const [rejectReason, setRejectReason] = useState<{ code: string; message: string } | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial session
  useEffect(() => {
    const sid = String(sessionId || '');
    if (!sid) return;

    let isMounted = true;
    async function fetchSession() {
      try {
        const res = await api.sessions.get(sid);
        if (!isMounted) return;
        setSession(res.session);
        setStatus(res.session.status);
        if (res.session.result) {
          setReceipt(res.session.result);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to fetch session');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId, toast]);

  // SSE connection for live status stream
  useEffect(() => {
    const sid = String(sessionId || '');
    if (!sid || status === 'VERIFIED' || status === 'EXPIRED') return;

    const sseUrl = `${API_BASE_URL}/v1/sessions/${sid}/events`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setSseConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          setStatus(data.status);
          if (data.status === 'VERIFIED' && data.result) {
            setReceipt(data.result);
            toast.success('Zero-knowledge presentation verified successfully!');
          } else if (data.status === 'VERIFIED' && data.receipt) {
            setReceipt(data.receipt);
            toast.success('Zero-knowledge presentation verified successfully!');
          } else if (data.status === 'REJECTED') {
            setRejectReason({
              code: data.reasonCode || 'REJECTED',
              message: data.error || 'The submitted presentation did not meet requirements.',
            });
            toast.error('Presentation was rejected by verification service');
          }
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      setSseConnected(false);
    };

    // Polling fallback every 3s
    const pollInterval = setInterval(async () => {
      try {
        const res = await api.sessions.get(sid);
        if (res.session.status !== status) {
          setStatus(res.session.status);
          if (res.session.result) setReceipt(res.session.result);
        }
      } catch {
        // ignore polling error
      }
    }, 3000);

    return () => {
      es.close();
      clearInterval(pollInterval);
    };
  }, [sessionId, status, toast]);

  // Countdown timer
  useEffect(() => {
    if (!session?.expiresAt) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const exp = new Date(session.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((exp - now) / 1000));
      setSecondsRemaining(diffSec);

      if (diffSec <= 0 && status === 'PENDING') {
        setStatus('EXPIRED');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session, status]);

  if (loading) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading verification session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Session Not Found
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          The requested verification session does not exist or has expired.
        </p>
        <Button variant="primary" onClick={() => router.push('/verifier')}>
          Create New Verification Request
        </Button>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const pairingUrl = `${origin}/wallet/present?session=${sessionId}`;

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyPairingLink = async () => {
    await navigator.clipboard.writeText(pairingUrl);
    setCopiedLink(true);
    toast.success('Pairing link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem', maxWidth: '960px' }}>
      {/* Navigation & Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/verifier')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}
        >
          <ArrowLeft size={14} /> Back to Request Studio
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
                Live Verification Session
              </h1>
              {status === 'PENDING' && (
                <Badge variant="pending">
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', marginRight: '6px' }} />
                  Awaiting Proof
                </Badge>
              )}
              {status === 'VERIFIED' && (
                <Badge variant="valid">
                  <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                  Verified
                </Badge>
              )}
              {status === 'REJECTED' && (
                <Badge variant="revoked">
                  <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                  Rejected
                </Badge>
              )}
              {status === 'EXPIRED' && (
                <Badge variant="neutral">
                  <Clock size={12} style={{ marginRight: '4px' }} />
                  Expired
                </Badge>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Session ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{sessionId}</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {sseConnected && status === 'PENDING' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--status-valid)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-valid)' }} />
                Live SSE Connected
              </div>
            )}
            {secondsRemaining !== null && status === 'PENDING' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: secondsRemaining < 60 ? 'var(--status-revoked)' : 'var(--text-primary)',
                }}
              >
                <Clock size={16} />
                {formatCountdown(secondsRemaining)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STATE 1: PENDING -> Show QR Code & Instructions */}
      {status === 'PENDING' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* QR Screen */}
          <Card
            title="Scan to Present Credential"
            subtitle="Point holder identity wallet camera or enter pairing link"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
              <QRCodeDisplay payload={pairingUrl} size={240} />

              <div style={{ marginTop: '1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyPairingLink}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Copy size={14} />
                    {copiedLink ? 'Copied Link!' : 'Copy Pairing Link'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.open(pairingUrl, '_blank')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <ExternalLink size={14} />
                    Open in Wallet
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Verification Specification */}
          <Card
            title="Session Claims & Nonce"
            subtitle="Parameters verified against the zero-knowledge proof"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Audience Domain
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {session.domain}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Ephemeral Challenge Nonce
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', wordBreak: 'break-all' }}>
                  {session.challenge}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Required Predicates & Inequalities
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {session.request.requiredPredicates && session.request.requiredPredicates.length > 0 ? (
                    session.request.requiredPredicates.map((p, idx) => (
                      <Chip key={idx} variant="info">
                        Slot {p.index} ≥ {p.index === 5 ? (p.minThreshold / 100).toFixed(2) + ' GPA' : p.minThreshold}
                      </Chip>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>None specified (Standard presentation)</span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Trusted Issuers
                </div>
                <div>
                  {session.request.trustedIssuerKeyHashes && session.request.trustedIssuerKeyHashes.length > 0 ? (
                    session.request.trustedIssuerKeyHashes.map((h, i) => (
                      <div key={i} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {h.slice(0, 18)}...{h.slice(-10)}
                      </div>
                    ))
                  ) : (
                    <Badge variant="neutral">Any Approved Institutional Issuer</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* STATE 2: VERIFIED -> Show Full Verification Receipt */}
      {status === 'VERIFIED' && receipt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid var(--status-valid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 size={24} color="var(--status-valid)" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Zero-Knowledge Proof Accepted & Verified
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  BN254 Groth16 cryptographic proof was mathematically verified against the circuit verification key.
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/verifier/receipt/${sessionId}`)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Printer size={16} />
              Open Printable Receipt
            </Button>
          </div>

          <VerificationReceipt receipt={receipt} />
        </div>
      )}

      {/* STATE 3: REJECTED -> Show Human-Readable Error */}
      {status === 'REJECTED' && (
        <Card
          style={{
            border: '1px solid var(--status-revoked)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-revoked)',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <h2 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Presentation Verification Failed
            </h2>

            <Badge variant="revoked" style={{ marginBottom: '1rem' }}>
              Reason: {rejectReason?.code || 'INVALID_PRESENTATION'}
            </Badge>

            <p style={{ maxWidth: '500px', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {rejectReason?.message ||
                'The zero-knowledge proof or credentials submitted by the holder did not satisfy the cryptographic requirements or predicate constraints.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="primary" onClick={() => router.push('/verifier')}>
                Create New Request
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                <RotateCcw size={16} style={{ marginRight: '6px' }} />
                Retry Session
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STATE 4: EXPIRED -> Show Expired Notice */}
      {status === 'EXPIRED' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(107, 114, 128, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              <Clock size={24} />
            </div>

            <h2 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Verification Session Expired
            </h2>

            <p style={{ maxWidth: '460px', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              The time window allocated for this presentation session has elapsed. Challenge nonces expire to prevent replay attacks and cross-session correlation.
            </p>

            <Button variant="primary" onClick={() => router.push('/verifier')}>
              Create New Session
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
