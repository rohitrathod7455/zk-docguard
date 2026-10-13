'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Share2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { VerificationReceipt, VerificationReceiptData } from '../../../../components/verification/VerificationReceipt';
import { useToast } from '../../../../components/ui/Toast';
import { api } from '../../../../lib/api-client';

export default function StandaloneReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [receipt, setReceipt] = useState<VerificationReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<string>('PENDING');

  useEffect(() => {
    const id = String(sessionId || '');
    if (!id) return;

    async function loadReceipt() {
      try {
        const res = await api.sessions.get(id);
        setSessionStatus(res.session.status);
        if (res.session.result) {
          setReceipt(res.session.result);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    }

    loadReceipt();
  }, [sessionId, toast]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Receipt link copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading verification receipt...</p>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Receipt Unavailable
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          This session status is <strong>{sessionStatus}</strong>. A cryptographic verification receipt is generated only after a valid Groth16 zero-knowledge proof has been verified.
        </p>
        <Button variant="primary" onClick={() => router.push(`/verifier/session/${sessionId}`)}>
          Go to Session Screen
        </Button>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem', maxWidth: '780px' }}>
      {/* Top Toolbar (Hidden on print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/verifier/session/${sessionId}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <ArrowLeft size={14} /> Back to Session
        </Button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Share2 size={14} /> Share Link
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Printer size={14} /> Print Receipt
          </Button>
        </div>
      </div>

      {/* Render Component */}
      <VerificationReceipt receipt={receipt} />
    </div>
  );
}
