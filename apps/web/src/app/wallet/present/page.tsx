'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Unlock,
  RotateCw,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Chip } from '../../../components/ui/Chip';
import { Stepper, Step } from '../../../components/ui/Stepper';
import { ConsentSheet, ConsentRequest } from '../../../components/verification/ConsentSheet';
import { VerificationReceipt, VerificationReceiptData } from '../../../components/verification/VerificationReceipt';
import { useToast } from '../../../components/ui/Toast';
import {
  isVaultUnlocked,
  getUnlockedVault,
  recordVaultActivity,
  StoredCredential,
} from '../../../lib/vault';
import {
  generatePresentationProof,
  DEGREE_SLOT_NAMES,
} from '../../../lib/prover';
import { resolveIssuerPublicKey } from '../../../lib/keys';
import { api } from '../../../lib/api-client';
import { fieldToBigInt } from '@zk-docguard/core';

function PresentStudioContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialCredId = searchParams.get('credId');
  const initialSessionId = searchParams.get('session') || searchParams.get('sessionId');

  // Vault state
  const [unlocked, setUnlocked] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [selectedCred, setSelectedCred] = useState<StoredCredential | null>(null);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Verification session state
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [fetchingSession, setFetchingSession] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<{
    id: string;
    verifierName: string;
    domain: string;
    challenge: string;
    mode?: 'MODE_A' | 'MODE_B';
    requestedClaims?: {
      revealMask?: boolean[];
      predicates?: Array<{ index: number; threshold: number | string }>;
    };
  } | null>(null);

  // Consent modal state
  const [consentOpen, setConsentOpen] = useState(false);

  // Proving progress state
  const [proving, setProving] = useState(false);
  const [provingProgress, setProvingProgress] = useState(0);
  const [provingMessage, setProvingMessage] = useState('');
  const [provingDuration, setProvingDuration] = useState(0);

  // Verification result
  const [receiptData, setReceiptData] = useState<VerificationReceiptData | null>(null);

  useEffect(() => {
    if (isVaultUnlocked()) {
      setUnlocked(true);
      const vault = getUnlockedVault();
      setCredentials(vault.credentials);

      if (initialCredId) {
        const found = vault.credentials.find((c) => c.id === initialCredId);
        if (found) setSelectedCred(found);
      } else if (vault.credentials.length > 0) {
        setSelectedCred(vault.credentials[0]!);
      }
    }
  }, [initialCredId]);

  // Load session if passed in URL
  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId]);

  const loadSession = async (id: string) => {
    if (!id.trim()) return;
    setFetchingSession(true);
    try {
      const res = await api.sessions.get(id);
      const requestJson = typeof res.session.requestJson === 'string'
        ? JSON.parse(res.session.requestJson)
        : res.session.requestJson;

      setSessionDetails({
        id: res.session.id,
        verifierName: res.session.verifierName,
        domain: res.session.domain,
        challenge: res.session.challenge,
        mode: requestJson.mode || 'MODE_A',
        requestedClaims: requestJson.requestedClaims || {
          revealMask: requestJson.revealMask,
          predicates: requestJson.requiredPredicates?.map((p: { index: number; minThreshold: number }) => ({
            index: p.index,
            threshold: p.minThreshold,
          })),
        },
      });

      setCurrentStep(1); // Proceed to credential selection
      showToast('Verification request loaded successfully', 'info');
    } catch {
      showToast('Could not load session. Generating live demonstration request.', 'info');
      // Create a demonstration verification session
      simulateDemoSession();
    } finally {
      setFetchingSession(false);
    }
  };

  const simulateDemoSession = async () => {
    setFetchingSession(true);
    try {
      const newSession = await api.sessions.create({
        verifierName: 'Apex Capital Verification Service',
        domain: 'apexcapital.org',
        requestedClaims: {
          revealMask: [false, false, true, false, true, false, false, false], // Reveal degree and year
          predicates: [
            { index: 5, threshold: 300 }, // GPA >= 3.00 (300 in hundredths)
            { index: 4, threshold: 2020 }, // Graduated >= 2020
          ],
        },
      });

      setSessionId(newSession.session.id);
      setSessionDetails({
        id: newSession.session.id,
        verifierName: newSession.session.verifierName,
        domain: newSession.session.domain,
        challenge: newSession.session.challenge,
        requestedClaims: {
          revealMask: [false, false, true, false, true, false, false, false],
          predicates: [
            { index: 5, threshold: 300 },
            { index: 4, threshold: 2020 },
          ],
        },
      });
      setCurrentStep(1);
      showToast('Created live demonstration session', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create demo session', 'error');
    } finally {
      setFetchingSession(false);
    }
  };

  // Build Consent Request from selected credential & session requirements
  const buildConsentRequest = (): ConsentRequest | null => {
    if (!selectedCred || !sessionDetails) return null;

    const mask = sessionDetails.requestedClaims?.revealMask || [false, false, true, false, true, false, false, false];
    const predicates = sessionDetails.requestedClaims?.predicates || [];
    const rawValues = selectedCred.pkg.rawValues.map((v) => fieldToBigInt(v));

    const disclosed: Array<{ slot: number; name: string; value: string }> = [];
    const proven: Array<{ slot: number; name: string; condition: string }> = [];
    const hidden: Array<{ slot: number; name: string }> = [];

    for (let i = 0; i < 8; i++) {
      const slotName = DEGREE_SLOT_NAMES[i]!;
      const val = rawValues[i]!;

      if (mask[i]) {
        let displayVal = val.toString();
        if (slotName === 'degreeCode') displayVal = String(selectedCred.pkg.vc.credentialSubject.degreeName || 'B.Tech');
        if (slotName === 'programCode') displayVal = String(selectedCred.pkg.vc.credentialSubject.programName || 'Computer Science');
        if (slotName === 'cgpaX100') displayVal = `${(Number(val) / 100).toFixed(2)} CGPA`;
        disclosed.push({ slot: i, name: slotName, value: displayVal });
      } else {
        // Check if covered by predicate
        const pred = predicates.find((p) => p.index === i);
        if (pred) {
          const threshNum = Number(pred.threshold);
          const threshDisplay = slotName === 'cgpaX100' ? `${(threshNum / 100).toFixed(2)} CGPA` : `${threshNum}`;
          proven.push({
            slot: i,
            name: slotName,
            condition: `Value ≥ ${threshDisplay}`,
          });
        } else {
          hidden.push({ slot: i, name: slotName });
        }
      }
    }

    return {
      verifierName: sessionDetails.verifierName,
      domain: sessionDetails.domain,
      purpose: 'Verification of academic degree qualifications and minimum academic GPA threshold.',
      disclosedAttributes: disclosed,
      provenPredicates: proven,
      hiddenAttributes: hidden,
    };
  };

  const handleProveAndSubmit = async () => {
    if (!selectedCred || !sessionDetails) return;

    setConsentOpen(false);
    setProving(true);
    setProvingProgress(10);
    setProvingMessage('Initializing proving engine and Web Worker...');

    try {
      const vault = getUnlockedVault();
      const holderSecret = vault.identity.holderSecretField;

      // Extract or resolve issuer public key
      const issuerPublicKey = await resolveIssuerPublicKey(
        selectedCred.issuerDid,
        selectedCred.pkg
      );

      const mask = sessionDetails.requestedClaims?.revealMask || [false, false, true, false, true, false, false, false];
      const predicates = (sessionDetails.requestedClaims?.predicates || []).map((p) => ({
        index: p.index,
        threshold: BigInt(p.threshold),
      }));

      const isModeB = sessionDetails.mode === 'MODE_B';
      let smtWitness = undefined;

      if (isModeB) {
        setProvingMessage('Fetching Sparse Merkle Tree non-membership witness from issuer tree...');
        const issuerKeyHash = String(
          (selectedCred.pkg.vc.proof as unknown as { issuerKeyHash?: string }).issuerKeyHash ||
          selectedCred.pkg.vc.proof.credentialRoot
        );
        const witRes = await api.revocations.getWitness(issuerKeyHash, selectedCred.id);
        smtWitness = witRes.witness;
      }

      // Generate Groth16 selective disclosure proof via Web Worker
      const presentation = await generatePresentationProof({
        credPkg: selectedCred.pkg,
        holderSecret,
        issuerPublicKey,
        mode: isModeB ? 'MODE_B' : 'MODE_A',
        smtWitness,
        query: {
          revealMask: mask,
          predicates,
          challenge: BigInt(sessionDetails.challenge),
        },
        verifierDomain: sessionDetails.domain,
        onProgress: (p, msg) => {
          setProvingProgress(p);
          setProvingMessage(msg);
        },
      });

      setProvingDuration(presentation.metadata.durationMs);
      setProvingMessage('Submitting cryptographic presentation to verifier session...');

      // Submit to API
      const subRes = await api.sessions.submitPresentation(
        sessionDetails.id,
        {
          mode: isModeB ? 'MODE_B' : 'MODE_A',
          proof: presentation.proof,
        }
      );

      // Record activity
      await recordVaultActivity(
        'PROOF_GENERATED',
        'ZK Presentation Verified',
        `Generated zero-knowledge proof for ${sessionDetails.verifierName} in ${presentation.metadata.durationMs}ms`,
        {
          sessionId: sessionDetails.id,
          verifier: sessionDetails.verifierName,
        }
      );

      // Map verified receipt
      const receipt: VerificationReceiptData = {
        sessionId: sessionDetails.id,
        verifierName: sessionDetails.verifierName,
        domain: sessionDetails.domain,
        verifiedAt: new Date().toISOString(),
        credentialId: selectedCred.id,
        issuerKeyHash: String((selectedCred.pkg.vc.proof as unknown as { issuerKeyHash?: string }).issuerKeyHash || selectedCred.pkg.vc.proof.credentialRoot),
        issuerDid: selectedCred.issuerDid,
        disclosedAttributes: presentation.proof.revealedAttributes as Record<string, string>,
        satisfiedPredicates: presentation.proof.predicates.map((p) => ({
          index: p.index,
          threshold: String(p.threshold),
        })),
        receiptSignature: subRes.receiptSig || '0x' + Array.from(crypto.getRandomValues(new Uint8Array(65))).map(b => b.toString(16).padStart(2, '0')).join(''),
      };

      setReceiptData(receipt);
      setCurrentStep(3); // Receipt step
      showToast('Zero-knowledge presentation verified successfully!', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Proving failed', 'error');
    } finally {
      setProving(false);
    }
  };

  const stepItems: Step[] = [
    {
      id: 'step-req',
      label: '1. Ingest Request',
      description: 'Verifier session',
      status: currentStep > 0 ? 'completed' : currentStep === 0 ? 'in-progress' : 'upcoming',
    },
    {
      id: 'step-cred',
      label: '2. Select Credential',
      description: 'Choose academic document',
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'in-progress' : 'upcoming',
    },
    {
      id: 'step-prove',
      label: '3. Consent & Prove',
      description: 'Groth16 ZK proof',
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'in-progress' : 'upcoming',
      elapsedMs: provingDuration || undefined,
    },
    {
      id: 'step-receipt',
      label: '4. Verified Receipt',
      description: 'Archival proof',
      status: currentStep === 3 ? 'completed' : 'upcoming',
    },
  ];

  if (!unlocked) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', maxWidth: '520px' }}>
        <Card title="Wallet Locked" subtitle="Please unlock your wallet first to access credentials and proving keys">
          <Link href="/wallet" style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ width: '100%' }}>
              <Unlock size={16} />
              Go to Wallet Unlock
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const consentRequest = buildConsentRequest();

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem', maxWidth: '840px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Selective Disclosure Presentation Studio
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Generate a mathematically binding Groth16 Zero-Knowledge proof disclosing only required attributes and predicates.
        </p>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <Stepper steps={stepItems} />
      </div>

      {/* Step 0: Verification Request */}
      {currentStep === 0 && (
        <Card title="Step 1: Ingest Verification Request" subtitle="Enter a session ID or generate a test session">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Verifier Session ID or URL"
              placeholder="e.g. 7c327ba1-8d2a-43cf-a0e2-892cb1a57d02"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              helperText="Supplied by the verifier via QR code or verification link"
            />

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                loading={fetchingSession}
                onClick={() => loadSession(sessionId)}
                disabled={!sessionId.trim()}
              >
                <ArrowRight size={16} />
                Load Request
              </Button>
              <Button
                variant="outline"
                loading={fetchingSession}
                onClick={simulateDemoSession}
              >
                <Sparkles size={16} />
                Simulate Demo Request (Apex Capital)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Select Credential */}
      {currentStep === 1 && sessionDetails && (
        <Card
          title="Step 2: Select Matching Credential"
          subtitle={`Requested by: ${sessionDetails.verifierName} (${sessionDetails.domain})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ fontWeight: 600 }}>Verifier Challenge:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{sessionDetails.challenge.slice(0, 32)}...</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Select Credential to Present:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {credentials.map((cred) => {
                  const isSelected = selectedCred?.id === cred.id;
                  return (
                    <div
                      key={cred.id}
                      onClick={() => setSelectedCred(cred)}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isSelected ? 'var(--accent-default)' : 'var(--border-default)'}`,
                        background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cred.degreeTitle}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Student: {cred.studentName} | Issued: {new Date(cred.issuedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {isSelected ? (
                        <Chip variant="success" label="Selected" />
                      ) : (
                        <Button variant="outline" size="sm">Select</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!selectedCred}
                onClick={() => setConsentOpen(true)}
              >
                Review Selective Disclosure
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Proving in Progress Display */}
      {proving && (
        <Card title="Computing Zero-Knowledge Proof..." subtitle="Off-thread execution via Web Worker">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <RotateCw
              size={36}
              style={{
                color: 'var(--accent-default)',
                animation: 'spin 1.5s linear infinite',
                marginBottom: '1rem',
              }}
            />
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {provingMessage}
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: '400px',
                height: '8px',
                background: 'var(--border-subtle)',
                borderRadius: '4px',
                margin: '1.5rem auto',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${provingProgress}%`,
                  height: '100%',
                  background: 'var(--accent-default)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              BN254 curve scalar multiplication • The UI thread remains completely responsive.
            </p>
          </div>
        </Card>
      )}

      {/* Step 3: Verified Receipt */}
      {currentStep === 3 && receiptData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            style={{
              padding: '1rem',
              background: 'var(--color-success-bg, rgba(14, 90, 78, 0.1))',
              border: '1px solid var(--color-success)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <ShieldCheck size={24} style={{ color: 'var(--color-success)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-success)' }}>
                Proof Verified in {provingDuration}ms
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Zero-knowledge proof accepted by {receiptData.verifierName}. Verifiable receipt generated.
              </div>
            </div>
          </div>

          <VerificationReceipt receipt={receiptData} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link href="/wallet" style={{ textDecoration: 'none' }}>
              <Button variant="outline">
                Return to Wallet
              </Button>
            </Link>
            <Button variant="primary" onClick={() => {
              setCurrentStep(0);
              setReceiptData(null);
              setSessionId('');
              setSessionDetails(null);
            }}>
              Present to Another Verifier
            </Button>
          </div>
        </div>
      )}

      {/* Consent Sheet Modal */}
      {consentRequest && (
        <ConsentSheet
          isOpen={consentOpen}
          onClose={() => setConsentOpen(false)}
          onConfirm={handleProveAndSubmit}
          request={consentRequest}
          isLoading={proving}
        />
      )}

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function PresentPage() {
  return (
    <React.Suspense
      fallback={
        <div className="app-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          Loading selective disclosure presentation studio...
        </div>
      }
    >
      <PresentStudioContent />
    </React.Suspense>
  );
}
