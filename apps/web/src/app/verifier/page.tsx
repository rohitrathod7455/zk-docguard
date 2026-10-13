'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  History,
  Lock,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api-client';

interface IssuerOption {
  did: string;
  name: string;
  keyHash: string;
}

export default function VerifierRequestPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [verifierName, setVerifierName] = useState('Apex Verification Services');
  const [domain, setDomain] = useState('apexverification.org');
  const [validityWindow, setValidityWindow] = useState('15');

  // Selected claims (reveal mask 0..7)
  // 0: holderCommitment (always hidden), 1: schemaId
  // 2: degreeCode, 3: programCode, 4: graduationYear, 5: cgpaX100, 6: studentId, 7: expiry
  const [revealDegree, setRevealDegree] = useState(true);
  const [revealProgram, setRevealProgram] = useState(false);
  const [revealYear, setRevealYear] = useState(true);
  const [revealCgpa, setRevealCgpa] = useState(false);
  const [revealStudentId, setRevealStudentId] = useState(false);

  // Predicate constraints
  const [enableGpaPredicate, setEnableGpaPredicate] = useState(true);
  const [minGpa, setMinGpa] = useState('3.00'); // stored as 300 in hundredths

  const [enableYearPredicate, setEnableYearPredicate] = useState(false);
  const [minGradYear, setMinGradYear] = useState('2020');

  // Trusted issuers
  const [availableIssuers, setAvailableIssuers] = useState<IssuerOption[]>([]);
  const [selectedIssuerDid, setSelectedIssuerDid] = useState('all');

  const [loading, setLoading] = useState(false);

  // Fetch approved institutional issuers
  useEffect(() => {
    async function loadIssuers() {
      try {
        const records = await api.issuers.getAll('Active');
        if (records && Array.isArray(records)) {
          const mapped = records.map((r) => ({
            did: r.did,
            name: r.name || r.did.slice(0, 20),
            keyHash: r.zkKeyHash || '',
          }));
          setAvailableIssuers(mapped);
        }
      } catch (err) {
        console.warn('Could not load approved issuers:', err);
      }
    }
    loadIssuers();
  }, []);

  const handleApplyPreset = (preset: 'employment' | 'grad_admissions' | 'audit') => {
    if (preset === 'employment') {
      setRevealDegree(true);
      setRevealProgram(true);
      setRevealYear(true);
      setRevealCgpa(false); // Hidden!
      setRevealStudentId(false);
      setEnableGpaPredicate(true);
      setMinGpa('3.00');
      setEnableYearPredicate(false);
      toast.info('Applied preset: Employment Screening (GPA >= 3.00 hidden predicate)');
    } else if (preset === 'grad_admissions') {
      setRevealDegree(true);
      setRevealProgram(true);
      setRevealYear(true);
      setRevealCgpa(true);
      setRevealStudentId(true);
      setEnableGpaPredicate(true);
      setMinGpa('3.50');
      setEnableYearPredicate(true);
      setMinGradYear('2022');
      toast.info('Applied preset: Graduate Admissions (Full Academic Review)');
    } else if (preset === 'audit') {
      setRevealDegree(true);
      setRevealProgram(false);
      setRevealYear(true);
      setRevealCgpa(false);
      setRevealStudentId(false);
      setEnableGpaPredicate(false);
      setEnableYearPredicate(false);
      toast.info('Applied preset: Minimal Accreditation Audit (Degree & Year only)');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifierName.trim() || !domain.trim()) {
      toast.error('Please specify verifier name and domain');
      return;
    }

    setLoading(true);
    try {
      // Build reveal mask
      const revealMask = [
        false, // 0: holderCommitment
        false, // 1: schemaId
        revealDegree, // 2: degreeCode
        revealProgram, // 3: programCode
        revealYear, // 4: graduationYear
        revealCgpa, // 5: cgpaX100
        revealStudentId, // 6: studentId
        false, // 7: expiry
      ];

      // Build required attributes list
      const requiredAttributes: number[] = [];
      if (revealDegree) requiredAttributes.push(2);
      if (revealProgram) requiredAttributes.push(3);
      if (revealYear) requiredAttributes.push(4);
      if (revealCgpa) requiredAttributes.push(5);
      if (revealStudentId) requiredAttributes.push(6);

      // Build predicates list
      const predicates: Array<{ index: number; minThreshold: number }> = [];
      if (enableGpaPredicate) {
        const gpaNum = parseFloat(minGpa) || 3.0;
        predicates.push({ index: 5, minThreshold: Math.round(gpaNum * 100) });
      }
      if (enableYearPredicate) {
        const yearNum = parseInt(minGradYear, 10) || 2020;
        predicates.push({ index: 4, minThreshold: yearNum });
      }

      // Build trusted issuer list
      let trustedIssuerKeyHashes: string[] | undefined;
      if (selectedIssuerDid !== 'all') {
        const chosen = availableIssuers.find((i) => i.did === selectedIssuerDid);
        if (chosen?.keyHash) {
          trustedIssuerKeyHashes = [chosen.keyHash];
        }
      }

      const requestPayload = {
        revealMask,
        requiredAttributes,
        requiredPredicates: predicates,
        trustedIssuerKeyHashes,
        validityWindowMinutes: parseInt(validityWindow, 10) || 15,
      };

      const res = await api.sessions.create({
        verifierName: verifierName.trim(),
        domain: domain.trim(),
        request: requestPayload,
      });

      toast.success('Verification session created successfully');
      router.push(`/verifier/session/${res.sessionId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create verification session');
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1000px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
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
              <ShieldCheck size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>
              Verification Request Studio
            </h1>
            <Badge variant="accent">Phase 8 Live</Badge>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>
            Configure zero-knowledge selective disclosure parameters, range predicates, and trusted issuers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            onClick={() => router.push('/verifier/history')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <History size={16} />
            History Log
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/verify')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FileCheck2 size={16} />
            Public Verify
          </Button>
        </div>
      </div>

      {/* Preset Banner */}
      <Card
        style={{
          marginBottom: '1.75rem',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              Quick Policy Presets
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Select a standardized verification policy or customize individual fields below.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleApplyPreset('employment')}
            >
              Employment Screening
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleApplyPreset('grad_admissions')}
            >
              Graduate Admissions
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleApplyPreset('audit')}
            >
              Accreditation Audit
            </Button>
          </div>
        </div>
      </Card>

      <form onSubmit={handleCreateSession}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
          {/* Column 1: Verifier Profile & Trusted Issuers */}
          <Card
            title="1. Verifier Identity & Trust"
            subtitle="Parameters bound cryptographically into the challenge nonce"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Input
                label="Organization / Verifier Name"
                placeholder="Apex Verification Services"
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                required
              />

              <Input
                label="Audience Domain (Bound to Challenge)"
                placeholder="apexverification.org"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                helperText="Cryptographically hashed with nonce to prevent cross-verifier replay"
                required
              />

              <Select
                label="Trusted Issuer Policy"
                value={selectedIssuerDid}
                onChange={(e) => setSelectedIssuerDid(e.target.value)}
                options={[
                  { value: 'all', label: 'All Approved On-Chain Issuers (Default)' },
                  ...availableIssuers.map((iss) => ({
                    value: iss.did,
                    label: `${iss.name} (${iss.did.slice(0, 20)}...)`,
                  })),
                ]}
              />

              <Select
                label="Session Validity Window"
                value={validityWindow}
                onChange={(e) => setValidityWindow(e.target.value)}
                options={[
                  { value: '5', label: '5 Minutes (High Security)' },
                  { value: '15', label: '15 Minutes (Standard Recommendation)' },
                  { value: '30', label: '30 Minutes' },
                  { value: '60', label: '1 Hour (Long-running session)' },
                ]}
              />
            </div>
          </Card>

          {/* Column 2: Claims & Zero-Knowledge Predicates */}
          <Card
            title="2. Attribute Disclosures & Predicates"
            subtitle="Choose which data points to reveal vs prove zero-knowledge"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Granular Attribute Revelation
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: revealDegree ? 'var(--accent-subtle)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revealDegree}
                      onChange={(e) => setRevealDegree(e.target.checked)}
                    />
                    <span><strong>Degree Code & Name</strong> (e.g. B.Tech)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: revealProgram ? 'var(--accent-subtle)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revealProgram}
                      onChange={(e) => setRevealProgram(e.target.checked)}
                    />
                    <span><strong>Academic Program</strong> (e.g. Computer Science)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: revealYear ? 'var(--accent-subtle)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revealYear}
                      onChange={(e) => setRevealYear(e.target.checked)}
                    />
                    <span><strong>Graduation Year</strong> (e.g. 2026)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: revealCgpa ? 'var(--accent-subtle)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revealCgpa}
                      onChange={(e) => setRevealCgpa(e.target.checked)}
                    />
                    <span><strong>Cumulative GPA</strong> (Plaintext disclosure)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: revealStudentId ? 'var(--accent-subtle)' : 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revealStudentId}
                      onChange={(e) => setRevealStudentId(e.target.checked)}
                    />
                    <span><strong>Institutional Student ID</strong> (Personal Identifier)</span>
                  </label>
                </div>
              </div>

              {/* Zero-Knowledge Predicates */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={16} color="var(--accent-text)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ZK Range & Inequality Predicates
                  </span>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.875rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enableGpaPredicate}
                      onChange={(e) => setEnableGpaPredicate(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Minimum CGPA Threshold (ZK Inequality)
                    </span>
                  </label>
                  {enableGpaPredicate && (
                    <div style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                      <Input
                        label="Required GPA ≥"
                        value={minGpa}
                        onChange={(e) => setMinGpa(e.target.value)}
                        placeholder="3.00"
                        helperText="Proves GPA exceeds threshold without disclosing the exact score"
                      />
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.875rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enableYearPredicate}
                      onChange={(e) => setEnableYearPredicate(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Minimum Graduation Year (ZK Inequality)
                    </span>
                  </label>
                  {enableYearPredicate && (
                    <div style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                      <Input
                        label="Graduation Year ≥"
                        value={minGradYear}
                        onChange={(e) => setMinGradYear(e.target.value)}
                        placeholder="2020"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}
          >
            {loading ? 'Initializing Session...' : 'Generate QR Verification Session'}
            <ArrowRight size={18} />
          </Button>
        </div>
      </form>
    </div>
  );
}
