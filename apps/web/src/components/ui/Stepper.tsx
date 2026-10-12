'use client';

import React from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export type StepStatus = 'upcoming' | 'in-progress' | 'completed' | 'error';

export interface Step {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  elapsedMs?: number;
}

export interface StepperProps {
  steps: Step[];
  activeStepIndex?: number;
}

export function Stepper({ steps }: StepperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {steps.map((step, idx) => {
        const isUpcoming = step.status === 'upcoming';
        const isInProgress = step.status === 'in-progress';
        const isCompleted = step.status === 'completed';
        const isError = step.status === 'error';

        let iconBg = 'var(--bg-surface-muted)';
        let iconBorder = 'var(--border-default)';
        let iconColor = 'var(--text-muted)';

        if (isCompleted) {
          iconBg = 'var(--status-valid-bg)';
          iconBorder = 'var(--status-valid-border)';
          iconColor = 'var(--status-valid)';
        } else if (isInProgress) {
          iconBg = 'var(--accent-subtle)';
          iconBorder = 'var(--accent-default)';
          iconColor = 'var(--accent-text)';
        } else if (isError) {
          iconBg = 'var(--status-revoked-bg)';
          iconBorder = 'var(--status-revoked-border)';
          iconColor = 'var(--status-revoked)';
        }

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            {/* Step Icon / Status Bubble */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: iconBg,
                border: `1px solid ${iconBorder}`,
                color: iconColor,
                flexShrink: 0,
                marginTop: '2px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {isCompleted && <Check size={14} strokeWidth={2.5} />}
              {isInProgress && (
                <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              )}
              {isError && <AlertCircle size={14} strokeWidth={2.5} />}
              {isUpcoming && <span>{idx + 1}</span>}
            </div>

            {/* Step Details */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: isInProgress ? 600 : 500,
                    color: isUpcoming ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}
                >
                  {step.label}
                </span>

                {step.elapsedMs !== undefined && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {step.elapsedMs}ms
                  </span>
                )}
              </div>

              {step.description && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                    margin: 0,
                  }}
                >
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
