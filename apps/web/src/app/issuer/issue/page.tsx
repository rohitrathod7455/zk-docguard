'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Stepper, Step } from '../../../components/ui/Stepper';
import { Chip } from '../../../components/ui/Chip';
import { QRCodeDisplay } from '../../../components/ui/QRCodeDisplay';
import { CredentialCard } from '../../../components/credential/CredentialCard';
import { useToast } from '../../../components/ui/Toast';
import { useWallet } from '../../../components/auth/WalletContext';
import { executeSingleIssuance, IssuedDeliveryBundle } from '../../../lib/issuance';
import {
  ArrowLeft,
  FilePlus,
  Download,
  Copy,
  CheckCircle2,
  Lock,
  Upload,
} from 'lucide-react';

const INITIAL_STEPS: Step[] = [
  { id: '1', label: '1. Candidate & Schema', description: '8-slot Poseidon attributes', status: 'in-progress' },
  { id: '2', label: '2. Client-Side Encryption', description: 'AES-256-GCM cipher & IPFS pin', status: 'upcoming' },
  { id: '3', label: '3. Merkle Commitment', description: 'Poseidon tree & BabyJubJub EdDSA', status: 'upcoming' },
  { id: '4', label: '4. Blockchain Anchor', description: 'DocumentRegistry.sol state', status: 'upcoming' },
  { id: '5', label: '5. Holder Delivery', description: 'W3C VC package & QR claim', status: 'upcoming' },
];

export default function SingleIssuePage() {
  const { address } = useWallet();
  const effectiveAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const { showToast } = useToast();

  const [studentName, setStudentName] = useState('Alex Vance');
  const [studentId, setStudentId] = useState('NF2026-CS8821');
  const [degreeCode, setDegreeCode] = useState('1'); // B.Tech
  const [programCode, setProgramCode] = useState('101'); // Computer Science
  const [graduationYear, setGraduationYear] = useState('2026');
  const [cgpa, setCgpa] = useState('8.74');
  const [holderAddress, setHolderAddress] = useState('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
  const [customFile, setCustomFile] = useState<File | null>(null);

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [issuing, setIssuing] = useState(false);
  const [bundle, setBundle] = useState<IssuedDeliveryBundle | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCustomFile(e.target.files[0]);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    setBundle(null);

    // Update steps state
    const updateStepStatus = (id: string, status: Step['status']) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s)),
      );
    };

    try {
      updateStepStatus('1', 'completed');
      updateStepStatus('2', 'in-progress');

      let documentBytes: Uint8Array | undefined;
      if (customFile) {
        const buffer = await customFile.arrayBuffer();
        documentBytes = new Uint8Array(buffer);
      }

      const result = await executeSingleIssuance(
        {
          studentName,
          studentId,
          degreeCode: Number(degreeCode),
          programCode: Number(programCode),
          graduationYear: Number(graduationYear),
          cgpa: Number(cgpa),
          expiryTimestamp: 0, // Permanent
          holderAddress,
          documentBytes,
        },
        effectiveAddress,
        (stepDesc, status) => {
          if (stepDesc.includes('Encrypting')) {
            updateStepStatus('2', status === 'success' ? 'completed' : 'in-progress');
            if (status === 'success') updateStepStatus('3', 'in-progress');
          } else if (stepDesc.includes('Merkle')) {
            updateStepStatus('3', status === 'success' ? 'completed' : 'in-progress');
            if (status === 'success') updateStepStatus('4', 'in-progress');
          } else if (stepDesc.includes('Anchoring')) {
            updateStepStatus('4', status === 'success' ? 'completed' : 'in-progress');
            if (status === 'success') updateStepStatus('5', 'completed');
          }
        },
      );

      setBundle(result);
      showToast('success', 'Verifiable Credential successfully issued and anchored on-chain!');
    } catch (err: unknown) {
      console.error(err);
      showToast('error', (err as Error).message || 'Issuance pipeline encountered an error');
    } finally {
      setIssuing(false);
    }
  };

  const handleDownloadPackage = () => {
    if (!bundle) return;
    const blob = new Blob([bundle.exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential-${studentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('info', 'Credential package downloaded');
  };

  const handleCopyClaimLink = () => {
    if (!bundle) return;
    const link = `${window.location.origin}/wallet?claim=${encodeURIComponent(bundle.qrPayload)}`;
    navigator.clipboard.writeText(link);
    showToast('success', 'Claim link copied to clipboard');
  };

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
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
          Single Credential Issuance Studio
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Encode graduate attributes into the 8-slot Poseidon schema, client-side encrypt the diploma, and anchor on-chain.
        </p>
      </div>

      {/* Progressive Stepper */}
      <div style={{ marginBottom: '2rem' }}>
        <Stepper steps={steps} />
      </div>

      {!bundle ? (
        <form onSubmit={handleIssue}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Form Column */}
            <Card title="1. Candidate & Academic Attributes (8-Slot Schema)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Input
                  label="Candidate Full Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  hint="Conferred recipient name for W3C subject display"
                  required
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    label="Institutional Student ID (Slot 6)"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    hint="Poseidon-hashed in field element"
                    required
                  />

                  <Input
                    label="Holder Ethereum Address (Slot 0)"
                    value={holderAddress}
                    onChange={(e) => setHolderAddress(e.target.value)}
                    hint="Binds credential to holder secret"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Select
                    label="Degree Level (Slot 2)"
                    value={degreeCode}
                    onChange={(e) => setDegreeCode(e.target.value)}
                    options={[
                      { value: '1', label: '1 — Bachelor of Technology (B.Tech)' },
                      { value: '2', label: '2 — Master of Technology (M.Tech)' },
                      { value: '3', label: '3 — Bachelor of Science (B.Sc)' },
                      { value: '4', label: '4 — Master of Science (M.Sc)' },
                      { value: '5', label: '5 — Doctor of Philosophy (Ph.D)' },
                    ]}
                  />

                  <Select
                    label="Academic Program (Slot 3)"
                    value={programCode}
                    onChange={(e) => setProgramCode(e.target.value)}
                    options={[
                      { value: '101', label: '101 — Computer Science & Engineering' },
                      { value: '102', label: '102 — Electrical & Electronics' },
                      { value: '103', label: '103 — Mechanical Systems' },
                      { value: '104', label: '104 — Information Technology' },
                      { value: '105', label: '105 — Data Science & Machine Intelligence' },
                    ]}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <Input
                    label="Conferral Year (Slot 4)"
                    type="number"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value)}
                    min={2000}
                    max={2035}
                    required
                  />

                  <Input
                    label="Cumulative GPA (Slot 5)"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    hint="Scaled ×100 in circuit (e.g. 8.74 → 874)"
                    required
                  />
                </div>
              </div>
            </Card>

            {/* Document Upload & Cryptographic Guarantees */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Card title="2. Client-Side Document Encryption">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      border: '1px dashed var(--border-default)',
                      padding: '1.5rem',
                      borderRadius: 'var(--radius)',
                      textAlign: 'center',
                      background: 'var(--bg-surface-elevated)',
                    }}
                  >
                    <Upload size={24} style={{ color: 'var(--accent-text)', margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {customFile ? customFile.name : 'Upload Official Degree PDF'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {customFile
                        ? `${(customFile.size / 1024).toFixed(1)} KB — Ready to encrypt`
                        : 'Optional. If omitted, an official digital diploma will be generated.'}
                    </div>
                    <label
                      style={{
                        display: 'inline-block',
                        marginTop: '0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        color: 'var(--accent-text)',
                        textDecoration: 'underline',
                      }}
                    >
                      Browse local file
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      background: 'var(--accent-bg)',
                      border: '1px solid var(--accent-border)',
                      padding: '0.875rem 1rem',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.8125rem',
                      color: 'var(--accent-text)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.625rem',
                    }}
                  >
                    <Lock size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Zero-Knowledge Guarantee:</strong> Plaintext never leaves your browser.
                      AES-256-GCM encryption occurs locally before ciphertext is pinned to IPFS.
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={issuing}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    <FilePlus size={16} style={{ marginRight: '0.375rem' }} />
                    {issuing ? 'Executing Issuance Pipeline...' : 'Issue Credential & Anchor'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </form>
      ) : (
        /* Issuance Output & Delivery Package View */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Certificate Preview Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <CredentialCard
              credential={{
                credentialId: bundle.credentialId,
                docHash: bundle.docHash,
                schemaId: bundle.schemaId,
                degreeName: degreeCode === '1' ? 'Bachelor of Technology in Computer Science' : 'Graduate Conferred Degree',
                programName: programCode === '101' ? 'Computer Science & Engineering' : `Program ${programCode}`,
                institutionName: 'Northfield University',
                issuerDid: `did:ethr:31337:${effectiveAddress}`,
                holderName: studentName,
                studentId,
                graduationYear: Number(graduationYear),
                cgpa: `${cgpa} / 10.00`,
                issuedAt: new Date().toISOString(),
                status: 'Valid',
                cid: bundle.cid,
              }}
            />

            <Card title="Cryptographic Anchor Receipts">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.8125rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Document Hash (Plaintext keccak256)
                  </div>
                  <Chip value={bundle.docHash} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    IPFS Ciphertext CID (AES-256-GCM)
                  </div>
                  <Chip value={bundle.cid} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Blockchain Anchor Tx Hash
                  </div>
                  <Chip value={bundle.txHash} />
                </div>
              </div>
            </Card>
          </div>

          {/* Holder Delivery Package */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Card
              title="Holder Delivery Package"
              subtitle="W3C Verifiable Credential package ready for transfer"
              headerAction={<CheckCircle2 size={18} style={{ color: 'var(--status-valid-text)' }} />}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius)' }}>
                  <QRCodeDisplay
                    payload={bundle.qrPayload}
                    size={200}
                    label={`Scan with Identity Wallet to claim degree for ${studentName}`}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Button variant="primary" style={{ flex: 1 }} onClick={handleDownloadPackage}>
                    <Download size={14} style={{ marginRight: '0.375rem' }} /> Download .JSON Package
                  </Button>
                  <Button variant="outline" onClick={handleCopyClaimLink}>
                    <Copy size={14} style={{ marginRight: '0.375rem' }} /> Copy Claim Link
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBundle(null);
                    setSteps(INITIAL_STEPS);
                  }}
                  style={{ alignSelf: 'center', marginTop: '0.5rem' }}
                >
                  Issue Another Credential
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
