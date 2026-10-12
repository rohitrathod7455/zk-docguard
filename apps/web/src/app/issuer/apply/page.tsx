'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Chip } from '../../../components/ui/Chip';
import { useToast } from '../../../components/ui/Toast';
import { useWallet } from '../../../components/auth/WalletContext';
import { applyIssuer, getIssuer } from '../../../lib/api-client';
import { getOrDeriveIssuerKey } from '../../../lib/keys';
import { ArrowLeft, Building2, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function IssuerApplyPage() {
  const { address } = useWallet();
  const effectiveAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const { showToast } = useToast();

  const [name, setName] = useState('Northfield University');
  const [type, setType] = useState('university');
  const [domain, setDomain] = useState('https://northfield.edu');
  const [email, setEmail] = useState('registrar@northfield.edu');
  const [country, setCountry] = useState('United States');
  const [keyHash, setKeyHash] = useState('');
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const stored = await getOrDeriveIssuerKey(effectiveAddress);
      setKeyHash(stored.keyHashHex);

      const existing = await getIssuer(effectiveAddress);
      if (existing) {
        setExistingStatus(existing.status);
      }
    }
    load();
  }, [effectiveAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const did = `did:ethr:31337:${effectiveAddress.toLowerCase()}`;
      const metadataURI = `ipfs://QmMetadata${Date.now().toString(36)}`;

      const res = await applyIssuer({
        address: effectiveAddress,
        did,
        zkKeyHash: keyHash,
        metadataURI,
      });

      if (res.ok) {
        setSubmitted(true);
        setExistingStatus('Pending');
        showToast('success', 'Institutional onboarding application submitted successfully');
      } else {
        showToast('error', res.error || 'Failed to submit application');
      }
    } catch {
      showToast('error', 'Network error during application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem', maxWidth: '780px' }}>
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
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 0, fontWeight: 500 }}>
          Institutional Accreditation Application
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Apply for accredited issuer status in IssuerRegistry.sol to issue cryptographically verifiable credentials.
        </p>
      </div>

      {existingStatus && (
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building2 size={20} style={{ color: 'var(--accent-text)' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Application Status On Record</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Identity: <code>{effectiveAddress}</code>
              </div>
            </div>
          </div>
          <Badge variant={existingStatus === 'Active' ? 'valid' : 'pending'}>
            {existingStatus}
          </Badge>
        </div>
      )}

      {submitted ? (
        <Card style={{ padding: '2rem', textAlign: 'center' }}>
          <CheckCircle2 size={40} style={{ color: 'var(--status-valid-text)', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', margin: '0 0 0.5rem 0' }}>
            Application Submitted for Governance Review
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
            Your institutional metadata and BabyJubJub proving key hash have been submitted to the protocol authority.
            Once approved by the Root Registry Administrator, your account will gain on-chain issuing authority.
          </p>
          <Link href="/issuer">
            <Button variant="primary">Return to Issuer Console</Button>
          </Link>
        </Card>
      ) : (
        <Card title="Institutional Profile & Governance Parameters">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Accredited Legal Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="Official name of the university, board, or ministry"
              required
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Select
                label="Institution Type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                options={[
                  { value: 'university', label: 'Higher Education / University' },
                  { value: 'state_board', label: 'State Licensing Board' },
                  { value: 'ministry', label: 'Ministry of Education' },
                  { value: 'certifier', label: 'Accredited Testing Agency' },
                ]}
              />

              <Input
                label="Jurisdiction / Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input
                label="Official Website Domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                type="url"
                required
              />

              <Input
                label="Registrar Contact Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <ShieldAlert size={14} style={{ color: 'var(--accent-text)' }} />
                Cryptographic Anchor Bindings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Issuer Ethereum Address
                  </div>
                  <Chip value={effectiveAddress} truncateLength={6} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    BabyJubJub Key Hash
                  </div>
                  <Chip value={keyHash || '0x...'} truncateLength={6} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="primary" loading={submitting}>
                Submit Application to Administrator
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
