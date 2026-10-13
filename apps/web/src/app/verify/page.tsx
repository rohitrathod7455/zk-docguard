'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileCheck2,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  Search,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { api, CredentialRecordDto } from '../../lib/api-client';

export default function PublicDocumentVerifyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; hash: string } | null>(null);
  const [hashInput, setHashInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification result state
  const [verifiedRecord, setVerifiedRecord] = useState<CredentialRecordDto | null>(null);
  const [searchedHash, setSearchedHash] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Compute SHA-256 hash client-side
  const computeFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileProcess = async (file: File) => {
    try {
      const hash = await computeFileHash(file);
      setSelectedFile({
        name: file.name,
        size: file.size,
        hash,
      });
      setHashInput(hash);
      await executeVerify(hash);
    } catch {
      toast.error('Failed to compute document hash');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) await handleFileProcess(file);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = hashInput.trim();
    if (!clean.startsWith('0x') || clean.length !== 66) {
      toast.error('Please enter a valid 32-byte hexadecimal hash (0x followed by 64 hex characters)');
      return;
    }
    await executeVerify(clean);
  };

  const executeVerify = async (hash: string) => {
    setLoading(true);
    setSearchedHash(hash);
    setNotFound(false);
    setVerifiedRecord(null);

    try {
      const res = await api.credentials.getByDocHash(hash);
      if (res.ok && res.record) {
        setVerifiedRecord(res.record);
        toast.success('Document hash anchored on blockchain registry');
      } else {
        setNotFound(true);
        toast.warning('Document hash not found in registry');
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="app-container" style={{ padding: '2.5rem 1.5rem', maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-subtle)',
            color: 'var(--accent-text)',
            marginBottom: '1rem',
          }}
        >
          <FileCheck2 size={24} />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
          Public Document & Diploma Verification
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '580px', margin: '0 auto' }}>
          Verify document integrity against immutable on-chain smart contract anchors and cryptographic SMT revocation trees.
        </p>
      </div>

      {/* Upload Dropzone */}
      <Card style={{ marginBottom: '1.75rem' }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent-default)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: isDragging ? 'var(--accent-subtle)' : 'var(--bg-surface-elevated)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
            style={{ display: 'none' }}
          />

          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-text)',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <UploadCloud size={22} />
          </div>

          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {selectedFile ? selectedFile.name : 'Drag & drop document to verify hash'}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {selectedFile
              ? `${formatFileSize(selectedFile.size)} • Hash calculated client-side in browser`
              : 'Supports PDF, diploma scans, JSON credentials, and digital certificates'}
          </div>
        </div>

        {/* Manual Hash Input */}
        <form onSubmit={handleManualSearch} style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Or enter 32-byte document SHA-256 hash"
                placeholder="0x..."
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !hashInput.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px' }}
            >
              <Search size={16} />
              {loading ? 'Verifying...' : 'Verify On-Chain'}
            </Button>
          </div>
        </form>
      </Card>

      {/* VERIFIED RESULT CARD */}
      {verifiedRecord && (
        <Card
          style={{
            border: `1px solid ${verifiedRecord.status === 'Valid' ? 'var(--status-valid)' : 'var(--status-revoked)'}`,
            background: 'var(--bg-surface)',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Stamp */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {verifiedRecord.status === 'Valid' ? (
                  <CheckCircle2 size={24} color="var(--status-valid)" />
                ) : (
                  <AlertTriangle size={24} color="var(--status-revoked)" />
                )}
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                    {verifiedRecord.status === 'Valid'
                      ? 'Authentic Anchored Document'
                      : 'Revoked Credential Notice'}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Cryptographic hash registered in EVM DocumentRegistry
                  </div>
                </div>
              </div>

              <Badge variant={verifiedRecord.status === 'Valid' ? 'valid' : 'revoked'}>
                {verifiedRecord.status}
              </Badge>
            </div>

            {/* Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Document SHA-256 Hash
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {verifiedRecord.docHash}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Credential Identifier
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {verifiedRecord.credentialId}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Issuer Address & DID
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                  did:ethr:31337:{verifiedRecord.issuerAddress}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Anchoring Transaction
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-text)' }}>
                  {verifiedRecord.txHash
                    ? `${verifiedRecord.txHash.slice(0, 16)}...${verifiedRecord.txHash.slice(-10)}`
                    : 'On-Chain Anchored'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Storage Envelope (IPFS)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                  <Lock size={12} color="var(--text-muted)" />
                  <span>{verifiedRecord.cid.slice(0, 18)}... (AES-256-GCM)</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Registration Timestamp
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {new Date(verifiedRecord.issuedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* ZK Selective Disclosure Bridge Callout */}
            <div
              style={{
                marginTop: '0.5rem',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Need privacy-preserving selective disclosure?
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Present specific attributes or prove GPA thresholds without revealing raw document bytes.
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/wallet/present')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Present ZK Proof
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* NOT FOUND RESULT CARD */}
      {notFound && searchedHash && (
        <Card style={{ border: '1px solid var(--border-default)', marginBottom: '1.75rem' }}>
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--status-revoked)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={22} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
              Document Hash Not Registered
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '480px', margin: '0 auto 1.25rem auto', lineHeight: 1.5 }}>
              The calculated hash <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{searchedHash.slice(0, 16)}...</span> was not found on the EVM DocumentRegistry. This document may not have been issued through ZK-DocGuard, or it may have been modified.
            </p>

            <Button variant="secondary" onClick={() => router.push('/verifier')}>
              Request Verifier Challenge Instead
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
