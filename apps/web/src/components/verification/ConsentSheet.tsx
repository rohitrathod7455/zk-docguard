'use client';

import React from 'react';
import { Eye, ShieldCheck, EyeOff, Building, Check } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface ConsentRequest {
  verifierName: string;
  domain: string;
  purpose?: string;
  disclosedAttributes: Array<{ slot: number; name: string; value: string }>;
  provenPredicates: Array<{ slot: number; name: string; condition: string }>;
  hiddenAttributes: Array<{ slot: number; name: string }>;
}

export interface ConsentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  request: ConsentRequest;
  isLoading?: boolean;
}

export function ConsentSheet({
  isOpen,
  onClose,
  onConfirm,
  request,
  isLoading = false,
}: ConsentSheetProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Selective Disclosure Consent"
      description="Review exactly which data will be shared before generating your Zero-Knowledge proof."
      maxWidth="560px"
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose} disabled={isLoading}>
            Reject & Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={<Check size={16} />}
          >
            Authorize & Generate Proof
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Verifier Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-text)',
            }}
          >
            <Building size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {request.verifierName}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {request.domain} {request.purpose && `• ${request.purpose}`}
            </div>
          </div>
        </div>

        {/* 1. What will be REVEALED */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
            }}
          >
            <Eye size={15} color="var(--accent-text)" />
            <span>Attributes to be Revealed</span>
          </div>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {request.disclosedAttributes.length === 0 ? (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                None (Zero attributes will be disclosed)
              </div>
            ) : (
              request.disclosedAttributes.map((attr) => (
                <div
                  key={attr.slot}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.875rem',
                    fontSize: '0.8125rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-elevated)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{attr.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{attr.value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. What will be PROVEN WITHOUT REVEALING */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--status-valid)',
              marginBottom: '0.5rem',
            }}
          >
            <ShieldCheck size={15} />
            <span>Predicates Proven in Zero-Knowledge (Values Kept Secret)</span>
          </div>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {request.provenPredicates.length === 0 ? (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                None requested
              </div>
            ) : (
              request.provenPredicates.map((pred) => (
                <div
                  key={pred.slot}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.875rem',
                    fontSize: '0.8125rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--status-valid-bg)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{pred.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--status-valid)' }}>
                    {pred.condition} (Proven In-Circuit)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. What stays HIDDEN */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            <EyeOff size={15} />
            <span>Attributes Kept Completely Hidden</span>
          </div>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {request.hiddenAttributes.map((attr) => (
              <div
                key={attr.slot}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.8125rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-muted)',
                }}
              >
                <span>{attr.name}</span>
                <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Encrypted & Hidden</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
