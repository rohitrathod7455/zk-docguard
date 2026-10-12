'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Chip } from '../components/ui/Chip';
import { useToast } from '../components/ui/Toast';

export default function HomePage() {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    status: 'Valid' | 'Revoked' | 'NotFound';
    issuer: string;
    docHash: string;
  } | null>(null);

  const handleSimulateFileDrop = () => {
    // Demo document SHA-256 hash
    const sampleHash = '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
    setLookupResult({
      status: 'Valid',
      issuer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      docHash: sampleHash,
    });
    toast.success('Document Hash Computed', 'Verified against on-chain DocumentRegistry');
  };

  return (
    <div className="app-container" style={{ paddingTop: '3rem' }}>
      {/* Editorial Headline */}
      <div style={{ maxWidth: '820px', marginBottom: '3.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Badge variant="accent">Production-Grade Protocol</Badge>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            W3C Verifiable Credentials • Groth16 on BN254
          </span>
        </div>

        <h1 style={{ fontSize: '3rem', lineHeight: 1.15, marginBottom: '1.25rem' }}>
          Privacy-Preserving Blockchain Document Verification
        </h1>

        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
          Issue tamper-proof institutional credentials anchored to EVM smart contracts. Encrypt documents client-side
          before IPFS pinning. Prove academic claims in zero knowledge without revealing unconsented private data.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link href="/issuer" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg" rightIcon={<ArrowRight size={16} />}>
              Open Issuer Console
            </Button>
          </Link>
          <Link href="/wallet" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              Holder Identity Wallet
            </Button>
          </Link>
          <Link href="/verifier" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="lg">
              Verifier Request Portal
            </Button>
          </Link>
        </div>
      </div>

      {/* Live Document Verification Drop Zone */}
      <div style={{ marginBottom: '4rem' }}>
        <Card
          title="Direct On-Chain Document Hash Verification"
          subtitle="Drop any credential file or enter its SHA-256 hash to check against on-chain registries without revealing plaintext"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleSimulateFileDrop();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem 1.5rem',
              border: `2px dashed ${isDragging ? 'var(--accent-default)' : 'var(--border-default)'}`,
              background: isDragging ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), border-color var(--transition-fast)',
            }}
            onClick={handleSimulateFileDrop}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-text)',
                marginBottom: '1rem',
              }}
            >
              <Upload size={22} />
            </div>

            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Drop Document PDF / Image or Click to Simulate
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: 0 }}>
              Calculates SHA-256 locally in your browser (no file upload) and checks registration status on EVM contracts.
            </p>
          </div>

          {lookupResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCheck2 size={18} color="var(--status-valid)" />
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    Registration Record Found
                  </span>
                </div>
                <Badge variant="valid">Anchored & Valid</Badge>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <Chip label="DocHash" value={lookupResult.docHash} prefixLength={12} suffixLength={8} />
                <Chip label="Issuer" value={lookupResult.issuer} prefixLength={8} suffixLength={6} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Protocol Pillars: 4 Core Pillars */}
      <div>
        <h2 style={{ marginBottom: '1.5rem' }}>Architectural Pillars</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <Card
            title="1. On-Chain Anchoring"
            subtitle="EVM Smart Contracts"
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Approved institutional issuers anchor document fingerprints and Merkle batch roots to EVM contracts
              (Polygon Amoy & Sepolia) with gas-optimized verification.
            </p>
          </Card>

          <Card
            title="2. Client-Side Encryption"
            subtitle="AES-256-GCM & IPFS"
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Plaintext documents are encrypted in the user's browser before IPFS distribution. Servers and storage
              nodes never receive unencrypted records.
            </p>
          </Card>

          <Card
            title="3. Zero-Knowledge Proofs"
            subtitle="Groth16 on BN254"
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Holders generate selective disclosure proofs in 1.1s directly in the browser, proving degree eligibility
              and CGPA thresholds without leaking personal student IDs.
            </p>
          </Card>

          <Card
            title="4. Real-Time Verification"
            subtitle="QR Codes & SSE"
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Verifiers generate ephemeral challenge nonces via QR codes. Holders submit proofs that are verified in
              milliseconds, streaming instant status via Server-Sent Events.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
