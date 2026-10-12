'use client';

import React from 'react';
import { ShieldCheck, Printer, Download, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Chip } from '../ui/Chip';

export interface VerificationReceiptData {
  sessionId: string;
  verifierName: string;
  domain: string;
  verifiedAt: string;
  credentialId: string;
  issuerKeyHash: string;
  issuerDid?: string;
  txHash?: string;
  disclosedAttributes: Record<number | string, string>;
  satisfiedPredicates: Array<{ index: number; threshold: string }>;
  receiptSignature: string;
}

export interface VerificationReceiptProps {
  receipt: VerificationReceiptData;
}

const ATTRIBUTE_NAMES: Record<number, string> = {
  0: 'Holder Commitment',
  1: 'Schema Identifier',
  2: 'Degree Type',
  3: 'Academic Program',
  4: 'Graduation Year',
  5: 'Cumulative GPA (CGPA)',
  6: 'Institutional Student ID',
  7: 'Credential Expiry',
};

const DEGREE_NAMES: Record<string, string> = {
  '1': 'B.Tech (Bachelor of Technology)',
  '2': 'M.Tech (Master of Technology)',
  '3': 'B.Sc (Bachelor of Science)',
  '4': 'M.Sc (Master of Science)',
  '5': 'Ph.D (Doctor of Philosophy)',
};

export function VerificationReceipt({ receipt }: VerificationReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(receipt, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `zk-receipt-${receipt.sessionId.slice(0, 8)}.json`);
    dlAnchor.click();
  };

  return (
    <div
      className="printable-receipt"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '2rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header: Institutional Verification Stamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '2px solid var(--border-default)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
            <ShieldCheck size={22} color="var(--status-valid)" strokeWidth={2} />
            <h2
              style={{
                fontSize: '1.375rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Zero-Knowledge Verification Receipt
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
            Issued by ZK-DocGuard Self-Sovereign Identity Verification Protocol
          </p>
        </div>

        <Badge variant="valid">VERIFIED & VALID</Badge>
      </div>

      {/* Verifier & Session Metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          fontSize: '0.875rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Requesting Verifier
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{receipt.verifierName}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{receipt.domain}</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Timestamp
          </div>
          <div style={{ color: 'var(--text-primary)' }}>{new Date(receipt.verifiedAt).toUTCString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clock tolerance: ±300s verified</div>
        </div>
      </div>

      {/* Proved Cryptographic Claims Section */}
      <div>
        <h4
          style={{
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={14} color="var(--status-valid)" />
          Disclosed Attributes (Proven In-Circuit)
        </h4>

        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          {Object.entries(receipt.disclosedAttributes).map(([slot, rawVal]) => {
            const slotNum = Number(slot);
            const name = ATTRIBUTE_NAMES[slotNum] || `Attribute Slot ${slot}`;
            const displayVal = slotNum === 2 && DEGREE_NAMES[rawVal] ? DEGREE_NAMES[rawVal] : rawVal;

            return (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayVal}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Satisfied Predicates Section */}
      {receipt.satisfiedPredicates.length > 0 && (
        <div>
          <h4
            style={{
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle size={14} color="var(--status-valid)" />
            Cryptographic Predicates (Zero Value Exposure)
          </h4>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {receipt.satisfiedPredicates.map((pred, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  {ATTRIBUTE_NAMES[pred.index] || `Slot ${pred.index}`} Threshold
                </span>
                <span style={{ fontWeight: 600, color: 'var(--status-valid)' }}>
                  ≥ {Number(pred.threshold) / 100} (Satisfied)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undisclosed Attributes Privacy Guarantee */}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface-muted)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
        }}
      >
        <strong>Privacy Guarantee:</strong> Institutional student ID hash, private key commitments, and non-disclosed
        attributes were mathematically proven using Groth16 on BN254 curve and remain 100% confidential.
      </div>

      {/* Cryptographic Identifiers & Signatures */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Chip label="Credential ID" value={receipt.credentialId} prefixLength={10} suffixLength={8} />
        <Chip label="Issuer Key Hash" value={receipt.issuerKeyHash} prefixLength={10} suffixLength={8} />
        <Chip label="Receipt HMAC" value={receipt.receiptSignature} prefixLength={12} suffixLength={10} />
      </div>

      {/* Action Buttons (Excluded from Print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <Button variant="outline" size="sm" onClick={handleDownload} leftIcon={<Download size={14} />}>
          Download JSON
        </Button>
        <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<Printer size={14} />}>
          Print Receipt
        </Button>
      </div>
    </div>
  );
}
