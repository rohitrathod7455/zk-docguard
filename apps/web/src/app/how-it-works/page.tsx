'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export default function HowItWorksPage() {
  return (
    <div className="app-container" style={{ padding: '3rem 1.5rem', maxWidth: '960px' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Badge variant="accent" style={{ marginBottom: '0.75rem' }}>
          Zero-Knowledge Architecture
        </Badge>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
          How ZK-DocGuard Preserves Document Privacy
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
          A dual-layer verification protocol combining Ethereum on-chain anchoring with client-side Groth16 zero-knowledge proofs over BN254.
        </p>
      </div>

      {/* 4 Pillars Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <Card
          title="1. Issuance & Anchoring"
          subtitle="Cryptographic signatures + on-chain root"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              The institution constructs an 8-slot Poseidon Merkle tree over degree attributes and signs the commitment root using BabyJubJub EdDSA.
            </p>
            <p style={{ margin: 0 }}>
              The document is encrypted in-browser using AES-256-GCM and anchored to the EVM DocumentRegistry.
            </p>
          </div>
        </Card>

        <Card
          title="2. Self-Sovereign Vault"
          subtitle="Client-side PBKDF2 + AES-GCM"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              The holder imports the verifiable credential into an encrypted browser vault protected by PBKDF2 (600,000 iterations).
            </p>
            <p style={{ margin: 0 }}>
              Neither private keys, salts, nor credentials ever leave the device in plaintext.
            </p>
          </div>
        </Card>

        <Card
          title="3. In-Browser Proving"
          subtitle="Off-thread Web Worker Groth16"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              A dedicated Web Worker computes witness signals and executes `snarkjs.groth16.fullProve` over BN254.
            </p>
            <p style={{ margin: 0 }}>
              Only selected claims (e.g. GPA ≥ 3.00) are evaluated, without exposing student ID or exact scores.
            </p>
          </div>
        </Card>

        <Card
          title="4. Live Verification"
          subtitle="Challenge nonce + signed receipt"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>
              The verifier accepts the presentation via QR session and validates the 26 public signals and mathematical SNARK proof.
            </p>
            <p style={{ margin: 0 }}>
              A tamper-proof HMAC verification receipt is generated for employment or licensing records.
            </p>
          </div>
        </Card>
      </div>

      {/* Deep-Dive Technical Table */}
      <Card
        title="Privacy Guarantees by Design"
        subtitle="Zero unrevealed data transmitted over the wire"
        style={{ marginBottom: '3rem' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Component</th>
                <th style={{ padding: '0.75rem 1rem' }}>Standard System</th>
                <th style={{ padding: '0.75rem 1rem' }}>ZK-DocGuard Protocol</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Document Storage</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>Plaintext PDF on server/IPFS</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--status-valid)' }}>AES-256-GCM ciphertext, decrypted client-side only</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Attribute Disclosure</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>All or nothing (Full transcript sent)</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--status-valid)' }}>Selective disclosure with zero-knowledge threshold predicates</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Replay Resistance</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>Static PDF or signed link reused across verifiers</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--status-valid)' }}>Ephemeral challenge bound to verifier domain in-circuit</td>
              </tr>
              <tr>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>Revocation Status</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>Centralized API query leaking student tracking</td>
                <td style={{ padding: '0.875rem 1rem', color: 'var(--status-valid)' }}>Cryptographic SMT non-membership proofs on-chain</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* CTA Bottom Banner */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/verifier">
          <Button variant="primary" size="lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Try Verifier Studio
            <ArrowRight size={16} />
          </Button>
        </Link>
        <Link href="/verify">
          <Button variant="secondary" size="lg">
            Verify a Document
          </Button>
        </Link>
      </div>
    </div>
  );
}
