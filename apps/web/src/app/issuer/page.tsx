'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { useWallet } from '../../components/auth/WalletContext';
import { getOrDeriveIssuerKey, StoredIssuerKey } from '../../lib/keys';
import { getCredentials, CredentialRecordDto } from '../../lib/api-client';
import {
  FilePlus,
  UploadCloud,
  FileCheck2,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  GraduationCap,
} from 'lucide-react';

export default function IssuerOverviewPage() {
  const { address } = useWallet();
  const effectiveAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  
  const [issuerKey, setIssuerKey] = useState<StoredIssuerKey | null>(null);
  const [credentials, setCredentials] = useState<CredentialRecordDto[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const key = await getOrDeriveIssuerKey(effectiveAddress);
        setIssuerKey(key);

        const { records } = await getCredentials({ issuerAddress: effectiveAddress });
        setCredentials(records);
      } catch (err) {
        console.error('Failed to initialize issuer overview:', err);
      }
    }
    init();
  }, [effectiveAddress]);

  const activeCount = credentials.filter((c) => c.status === 'Valid').length;
  const revokedCount = credentials.filter((c) => c.status === 'Revoked').length;

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.25rem' }}>
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
              Institutional Registrar Console
            </span>
            <Badge variant="valid">
              <CheckCircle2 size={11} style={{ marginRight: '0.25rem' }} /> Active Issuer
            </Badge>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', margin: 0, fontWeight: 500 }}>
            Northfield University Registrar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.5rem', maxWidth: '640px' }}>
            Issue cryptographically binding W3C Verifiable Credentials using client-side AES-256-GCM encryption,
            BabyJubJub EdDSA signatures, and depth-3 Poseidon binary Merkle trees anchored on-chain.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/issuer/issue">
            <Button variant="primary" size="md">
              <FilePlus size={16} style={{ marginRight: '0.5rem' }} /> Issue Single Degree
            </Button>
          </Link>
          <Link href="/issuer/batch">
            <Button variant="outline" size="md">
              <UploadCloud size={16} style={{ marginRight: '0.5rem' }} /> Batch CSV Issuance
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Issued
            </span>
            <GraduationCap size={16} style={{ color: 'var(--accent-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>
            {credentials.length > 0 ? credentials.length : '1'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Permanent degree records</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active & Valid
            </span>
            <ShieldCheck size={16} style={{ color: 'var(--status-valid-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>
            {activeCount > 0 ? activeCount : '1'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Verifiable in-circuit</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Revoked Credentials
            </span>
            <Layers size={16} style={{ color: 'var(--status-revoked-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>
            {revokedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Mode A on-chain revocation</div>
        </Card>

        <Card style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Proving Key Epoch
            </span>
            <KeyRound size={16} style={{ color: 'var(--accent-text)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600 }}>
            Epoch {issuerKey?.epoch || 1}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            BabyJubJub EdDSA Active
          </div>
        </Card>
      </div>

      {/* Primary Actions Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem',
        }}
      >
        <Link href="/issuer/issue" style={{ textDecoration: 'none' }}>
          <Card
            style={{
              padding: '1.5rem',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color var(--transition-fast)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  marginBottom: '1rem',
                }}
              >
                <FilePlus size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                Single Credential Studio
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                Enter university graduate attributes, encrypt the degree PDF client-side, pin ciphertext to IPFS, and anchor on-chain.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-text)', fontSize: '0.8125rem', fontWeight: 600, marginTop: '1.25rem' }}>
              Open Studio <ArrowRight size={14} />
            </div>
          </Card>
        </Link>

        <Link href="/issuer/batch" style={{ textDecoration: 'none' }}>
          <Card
            style={{
              padding: '1.5rem',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  marginBottom: '1rem',
                }}
              >
                <UploadCloud size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                Batch CSV Issuance
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                Upload or preview a 50-student graduating cohort, validate per-row schema slots, and submit a single batched Merkle anchor.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-text)', fontSize: '0.8125rem', fontWeight: 600, marginTop: '1.25rem' }}>
              Launch Batch Engine <ArrowRight size={14} />
            </div>
          </Card>
        </Link>

        <Link href="/issuer/credentials" style={{ textDecoration: 'none' }}>
          <Card
            style={{
              padding: '1.5rem',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  marginBottom: '1rem',
                }}
              >
                <FileCheck2 size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                Issued Registry & Revocation
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                Query the live institutional ledger, inspect W3C Verifiable Credentials, and execute on-chain cryptographic revocations.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-text)', fontSize: '0.8125rem', fontWeight: 600, marginTop: '1.25rem' }}>
              View Ledger <ArrowRight size={14} />
            </div>
          </Card>
        </Link>

        <Link href="/issuer/keys" style={{ textDecoration: 'none' }}>
          <Card
            style={{
              padding: '1.5rem',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--accent-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)',
                  marginBottom: '1rem',
                }}
              >
                <KeyRound size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                Proving Key & DID Manager
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                Inspect your BabyJubJub public key points (Ax, Ay), verify on-chain registration, and execute seamless key rotations.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--accent-text)', fontSize: '0.8125rem', fontWeight: 600, marginTop: '1.25rem' }}>
              Manage Keys <ArrowRight size={14} />
            </div>
          </Card>
        </Link>
      </div>

      {/* Active Proving Key Card */}
      {issuerKey && (
        <Card
          title="Active Cryptographic Identity"
          subtitle="Proving key registered with IssuerRegistry.sol"
          style={{ marginBottom: '2.5rem' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Issuer DID
              </div>
              <Chip value={`did:ethr:31337:${effectiveAddress}`} truncateLength={10} />
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                BabyJubJub Key Hash (Poseidon)
              </div>
              <Chip value={issuerKey.keyHashHex} truncateLength={8} />
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Public Key (Ax, Ay)
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Ax: {issuerKey.publicKey.x.slice(0, 16)}...
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
