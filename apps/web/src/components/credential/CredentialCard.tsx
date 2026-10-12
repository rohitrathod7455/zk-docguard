'use client';

import React from 'react';
import { Award, ShieldCheck, FileText } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

export interface CredentialCardData {
  credentialId: string;
  docHash: string;
  schemaId: string;
  degreeName: string;
  programName: string;
  institutionName: string;
  issuerDid: string;
  holderName: string;
  studentId: string;
  graduationYear: number;
  cgpa: string;
  issuedAt: string;
  expiry?: string;
  status: 'Valid' | 'Revoked' | 'Expired';
  cid: string;
}

export interface CredentialCardProps {
  credential: CredentialCardData;
  onPresent?: (credentialId: string) => void;
  onViewDetails?: (credentialId: string) => void;
  isCompact?: boolean;
}

export function CredentialCard({
  credential,
  onPresent,
  onViewDetails,
  isCompact = false,
}: CredentialCardProps) {
  const isRevoked = credential.status === 'Revoked';
  const isExpired = credential.status === 'Expired';
  const badgeVariant = isRevoked ? 'revoked' : isExpired ? 'pending' : 'valid';

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: isCompact ? '1.25rem' : '1.75rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        overflow: 'hidden',
      }}
    >
      {/* Decorative Archival Inner Border */}
      <div
        style={{
          position: 'absolute',
          inset: '6px',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          pointerEvents: 'none',
        }}
      />

      {/* Header: Institution & Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-text)',
            }}
          >
            <Award size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {credential.institutionName}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Self-Sovereign Credential
            </div>
          </div>
        </div>

        <Badge variant={badgeVariant}>{credential.status}</Badge>
      </div>

      {/* Main Title: Degree & Program */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0.25rem 0' }}>
        <h3
          style={{
            fontSize: isCompact ? '1.25rem' : '1.5rem',
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.25,
            marginBottom: '0.25rem',
          }}
        >
          {credential.degreeName}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Major in {credential.programName}
        </p>
      </div>

      {/* Holder & Academic Attributes Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Conferred To
          </span>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {credential.holderName}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Student ID
          </span>
          <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {credential.studentId}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Graduation Year
          </span>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {credential.graduationYear}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            CGPA
          </span>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {credential.cgpa} / 10.00
          </div>
        </div>
      </div>

      {/* Cryptographic Identifiers */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Chip label="ID" value={credential.credentialId} prefixLength={8} suffixLength={6} />
        <Chip label="CID" value={credential.cid} prefixLength={8} suffixLength={6} />
        <Chip label="Issuer" value={credential.issuerDid} prefixLength={12} suffixLength={4} />
      </div>

      {/* Action Footer */}
      {(onPresent || onViewDetails) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.625rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(credential.credentialId)}
              leftIcon={<FileText size={14} />}
            >
              Document
            </Button>
          )}

          {onPresent && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onPresent(credential.credentialId)}
              leftIcon={<ShieldCheck size={14} />}
              disabled={isRevoked || isExpired}
            >
              Generate ZK Proof
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
