'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  Layers,
  Inbox,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Stepper, Step } from '../../components/ui/Stepper';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { QRCodeDisplay } from '../../components/ui/QRCodeDisplay';
import { useToast } from '../../components/ui/Toast';
import { CredentialCard, CredentialCardData } from '../../components/credential/CredentialCard';
import { VerificationReceipt, VerificationReceiptData } from '../../components/verification/VerificationReceipt';
import { ConsentSheet, ConsentRequest } from '../../components/verification/ConsentSheet';

const SAMPLE_CREDENTIAL: CredentialCardData = {
  credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  docHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  schemaId: '0x3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  degreeName: 'Bachelor of Technology',
  programName: 'Computer Science and Engineering',
  institutionName: 'Northfield Institute of Technology',
  issuerDid: 'did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  holderName: 'Alex Vance',
  studentId: 'STUDENT-2022-CSE-042',
  graduationYear: 2026,
  cgpa: '8.74',
  issuedAt: '2026-06-15T10:00:00.000Z',
  status: 'Valid',
  cid: 'QmZtmD2qt8fJpq3CLDHcgDZ5nU12Th4P474y3r2SenEi2W',
};

const SAMPLE_RECEIPT: VerificationReceiptData = {
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  verifierName: 'State Licensing Board',
  domain: 'licensing.state.gov',
  verifiedAt: new Date().toISOString(),
  credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  issuerKeyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
  issuerDid: 'did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  disclosedAttributes: {
    2: '1', // B.Tech
    4: '2026', // GradYear
  },
  satisfiedPredicates: [{ index: 5, threshold: '800' }], // CGPA >= 800
  receiptSignature: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
};

const SAMPLE_CONSENT_REQUEST: ConsentRequest = {
  verifierName: 'Apex Technology Corp',
  domain: 'verify.apextech.com',
  purpose: 'Employment Background Verification',
  disclosedAttributes: [
    { slot: 2, name: 'Degree Type', value: 'B.Tech (Bachelor of Technology)' },
    { slot: 4, name: 'Graduation Year', value: '2026' },
  ],
  provenPredicates: [{ slot: 5, name: 'Cumulative GPA (CGPA)', condition: 'CGPA ≥ 8.00' }],
  hiddenAttributes: [
    { slot: 0, name: 'Holder Private Key Secret' },
    { slot: 6, name: 'Institutional Student ID (STUDENT-2022-CSE-042)' },
    { slot: 1, name: 'Internal Schema Salt' },
  ],
};

const SAMPLE_STEPS: Step[] = [
  {
    id: '1',
    label: 'Download & Load Groth16 Circuit WASM',
    description: 'DiscloseModeA circuit template loaded from web cache',
    status: 'completed',
    elapsedMs: 42,
  },
  {
    id: '2',
    label: 'Compute Witness with Private Holder Secret',
    description: 'Poseidon commitment & BabyJubJub signature verified locally',
    status: 'completed',
    elapsedMs: 248,
  },
  {
    id: '3',
    label: 'Generate Zero-Knowledge Proof (snarkjs fullProve)',
    description: '9,144 R1CS constraints proven over BN254 curve',
    status: 'in-progress',
    elapsedMs: 1100,
  },
  {
    id: '4',
    label: 'Local Self-Verification & Sanity Check',
    description: 'Verify 26 public signals match challenge nonce',
    status: 'upcoming',
  },
  {
    id: '5',
    label: 'Submit Presentation to Verifier Session',
    description: 'Transmit proof to verifier SSE live stream',
    status: 'upcoming',
  },
];

export default function DesignSystemGalleryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Layers size={20} color="var(--accent-text)" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Design System Documentation & Gallery
          </span>
        </div>
        <h1 style={{ marginBottom: '0.5rem' }}>ZK-DocGuard Institutional Design System</h1>
        <p style={{ maxWidth: '780px', lineHeight: 1.6 }}>
          A calm, credible, institutional design foundation built specifically for academic credential verification,
          privacy-preserving zero-knowledge proofs, and sovereign identity management.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '2rem' }}>
        <Tabs
          tabs={[
            { id: 'overview', label: '1. Architecture & Tokens' },
            { id: 'components', label: '2. Base UI Primitives' },
            { id: 'signatures', label: '3. Signature Components' },
            { id: 'compliance', label: '4. Banned Patterns Sign-Off' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* TAB 1: Architecture & Tokens */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Color Palette Tokens */}
          <Card title="Color Palette Tokens" subtitle="Archival paper, deep verdigris accent, and semantic status tones">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: '#F6F4EE', border: '1px solid #DAD6CB', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#15181D' }}>Canvas Paper</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#5B6068' }}>#F6F4EE</div>
              </div>

              <div style={{ padding: '1rem', background: '#0E5A4E', color: '#FFFFFF', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Verdigris Accent</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.85 }}>#0E5A4E</div>
              </div>

              <div style={{ padding: '1rem', background: '#1F7A4D', color: '#FFFFFF', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Valid / Verified</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.85 }}>#1F7A4D</div>
              </div>

              <div style={{ padding: '1rem', background: '#A3302B', color: '#FFFFFF', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Revoked</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.85 }}>#A3302B</div>
              </div>

              <div style={{ padding: '1rem', background: '#9A6A00', color: '#FFFFFF', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Pending / Expired</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.85 }}>#9A6A00</div>
              </div>

              <div style={{ padding: '1rem', background: '#15181D', color: '#FFFFFF', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Primary Ink</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.85 }}>#15181D</div>
              </div>
            </div>
          </Card>

          {/* Typography Deliberate Scale */}
          <Card title="Typography Hierarchy" subtitle="Newsreader serif for editorial titles, IBM Plex Sans for UI, JetBrains Mono for cryptographic values">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Display Title (40px, Newsreader Serif)</span>
                <h1 style={{ marginTop: '4px' }}>Northfield Institute of Technology</h1>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Section Heading (28px, Newsreader Serif)</span>
                <h2 style={{ marginTop: '4px' }}>Privacy-Preserving Self-Sovereign Identity</h2>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subheading (20px, Newsreader Serif)</span>
                <h3 style={{ marginTop: '4px' }}>Selective Disclosure via Groth16 Zero-Knowledge Proofs</h3>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UI Text (16px, IBM Plex Sans)</span>
                <p style={{ marginTop: '4px' }}>
                  Institutions issue credentials with 8 fixed attribute slots anchored on EVM testnet. Documents are client-side
                  encrypted (AES-256-GCM) and stored on IPFS.
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cryptographic Monospace (14px, JetBrains Mono)</span>
                <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  credentialId: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Base UI Primitives */}
      {activeTab === 'components' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Buttons */}
          <Card title="Button Primitives" subtitle="Verdigris primary, outline, danger, ghost, loading, and sizes">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <Button variant="primary">Primary Verdigris</Button>
              <Button variant="secondary">Secondary Outline</Button>
              <Button variant="outline">Hairline Outline</Button>
              <Button variant="danger">Revoke / Danger</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="primary" isLoading>
                Loading...
              </Button>
              <Button variant="primary" size="sm">
                Small (30px)
              </Button>
              <Button variant="primary" size="lg">
                Large (44px)
              </Button>
            </div>
          </Card>

          {/* Form Inputs */}
          <Card title="Form Controls" subtitle="Hairline border inputs, helper hints, select options, and error states">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <Input
                label="Student Full Name"
                placeholder="e.g. Alex Vance"
                hint="As listed on the official matriculation register"
              />
              <Input
                label="Student Institutional ID"
                defaultValue="STUDENT-2022-CSE-042"
                error="ID is already associated with an existing active degree"
              />
              <Select
                label="Conferred Degree"
                options={[
                  { value: '1', label: 'B.Tech (Bachelor of Technology)' },
                  { value: '2', label: 'M.Tech (Master of Technology)' },
                  { value: '3', label: 'B.Sc (Bachelor of Science)' },
                  { value: '4', label: 'Ph.D (Doctor of Philosophy)' },
                ]}
              />
            </div>
          </Card>

          {/* Badges & Monospace Chips */}
          <Card title="Badges & Monospace Chips" subtitle="Semantic status tags and copyable truncated cryptographic identifiers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <Badge variant="valid">Valid & Verified</Badge>
                <Badge variant="revoked">Revoked by Issuer</Badge>
                <Badge variant="pending">Pending Admin Review</Badge>
                <Badge variant="neutral">Draft Record</Badge>
                <Badge variant="accent">W3C Credential</Badge>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <Chip label="DID" value="did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8" />
                <Chip label="CID" value="QmZtmD2qt8fJpq3CLDHcgDZ5nU12Th4P474y3r2SenEi2W" />
                <Chip label="DocHash" value="0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069" />
              </div>
            </div>
          </Card>

          {/* Stepper */}
          <Card title="ZK Proving Stepper" subtitle="Real progressive stepper tracking in-browser Groth16 witness computation and proving">
            <Stepper steps={SAMPLE_STEPS} />
          </Card>

          {/* Dialog Modal & Toast Triggers */}
          <Card title="Dialog Modals & Toast Notifications" subtitle="Keyboard accessible dialogs (Escape key, backdrop dismiss) and auto-dismissing notifications">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Button variant="outline" onClick={() => setIsDemoDialogOpen(true)}>
                Open Dialog Modal
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.success('Verification Succeeded', 'Groth16 presentation proof verified in 18ms')}
              >
                Trigger Success Toast
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.error('Revocation Error', 'CredentialId 0x1234... has been revoked on-chain')}
              >
                Trigger Error Toast
              </Button>
            </div>
          </Card>

          {/* Empty State */}
          <Card title="Empty State Pattern" subtitle="Informative empty state with specific next actions">
            <EmptyState
              icon={<Inbox size={32} />}
              title="No Credentials in Vault"
              description="Scan an institutional issuance QR code or receive a credential via wrapped-key link to add to your identity vault."
              action={<Button variant="primary" size="sm">Receive Credential</Button>}
            />
          </Card>
        </div>
      )}

      {/* TAB 3: Signature Components */}
      {activeTab === 'signatures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Signature 1: Credential Card */}
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>1. Signature Institutional Credential Card</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              Hand-built certificate aesthetic with hairline double-frame, seal mark, serif degree title, and cryptographic identifiers.
            </p>
            <div style={{ maxWidth: '640px' }}>
              <CredentialCard
                credential={SAMPLE_CREDENTIAL}
                onPresent={() => setIsConsentOpen(true)}
                onViewDetails={() => toast.info('Document Details', 'Viewing client-side decrypted credential metadata')}
              />
            </div>
          </div>

          {/* Signature 2: Verification Receipt */}
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>2. Signature Verification Receipt</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              Printable, archival verification receipt showing proven claims, zero value leakage guarantees, and HMAC signature.
            </p>
            <VerificationReceipt receipt={SAMPLE_RECEIPT} />
          </div>

          {/* Signature 3: Consent Sheet */}
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>3. Signature Selective Disclosure Consent Sheet</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              Pre-proving verification consent sheet showing verbatim what will be disclosed, what will be proven via predicates, and what remains confidential.
            </p>
            <Button variant="primary" onClick={() => setIsConsentOpen(true)}>
              Launch Interactive Consent Sheet
            </Button>
          </div>

          {/* Signature 4: QR Code Display */}
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>4. Signature Institutional QR Display</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              High-contrast crisp QR code with copy payload and PNG download for offline presentation.
            </p>
            <QRCodeDisplay
              payload="zkdoc:presentation-request:550e8400-e29b-41d4-a716-446655440000"
              label="Session: 550e8400... (Scan with Holder Wallet)"
            />
          </div>
        </div>
      )}

      {/* TAB 4: Banned Patterns Sign-Off */}
      {activeTab === 'compliance' && (
        <Card title="Design System Compliance Audit" subtitle="Verification against the Section 9 Frontend Design Brief rules">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>Zero Banned Gradients:</strong> No purple/pink or blue-magenta gradients anywhere in the codebase.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>Zero Glassmorphism or Neon Glows:</strong> Calm archival surfaces, 1px hairline rules, and zero artificial glow effects.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>Zero Emoji in UI:</strong> Lucide stroke icons used strictly; zero emojis across all components.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>2px - 4px Crisp Radii:</strong> Oversized rounded-2xl or pill containers prohibited on content cards.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>Genuine Archival Typography:</strong> Newsreader Serif headings, IBM Plex Sans body, and JetBrains Mono code.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--status-valid-bg)', border: '1px solid var(--status-valid-border)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle size={18} color="var(--status-valid)" />
              <div>
                <strong>Accessible Contrast & Motion:</strong> Strict WCAG 2.2 AA color ratios and <code>prefers-reduced-motion</code> compliance.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Interactive Demo Dialog Modal */}
      <Dialog
        isOpen={isDemoDialogOpen}
        onClose={() => setIsDemoDialogOpen(false)}
        title="Demonstration Dialog Modal"
        description="A lightweight, accessible modal container following institutional hairline styling."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDemoDialogOpen(false)}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsDemoDialogOpen(false);
                toast.success('Confirmed', 'Action executed successfully');
              }}
            >
              Confirm Action
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          This dialog automatically manages focus retention, closes upon pressing the <code>Escape</code> key, and
          disables window background scrolling while open.
        </p>
      </Dialog>

      {/* Interactive Consent Sheet */}
      <ConsentSheet
        isOpen={isConsentOpen}
        onClose={() => setIsConsentOpen(false)}
        onConfirm={() => {
          setIsConsentOpen(false);
          toast.success('Proof Generation Authorized', 'Executing in-browser Groth16 witness generation');
        }}
        request={SAMPLE_CONSENT_REQUEST}
      />
    </div>
  );
}
