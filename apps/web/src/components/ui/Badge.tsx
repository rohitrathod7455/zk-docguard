'use client';

import React, { ReactNode } from 'react';

export type BadgeVariant = 'valid' | 'revoked' | 'pending' | 'neutral' | 'accent';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ variant = 'neutral', children, icon, size = 'md' }: BadgeProps) {
  let background = 'var(--bg-surface-muted)';
  let color = 'var(--text-secondary)';
  let border = 'var(--border-default)';

  if (variant === 'valid') {
    background = 'var(--status-valid-bg)';
    color = 'var(--status-valid)';
    border = 'var(--status-valid-border)';
  } else if (variant === 'revoked') {
    background = 'var(--status-revoked-bg)';
    color = 'var(--status-revoked)';
    border = 'var(--status-revoked-border)';
  } else if (variant === 'pending') {
    background = 'var(--status-pending-bg)';
    color = 'var(--status-pending)';
    border = 'var(--status-pending-border)';
  } else if (variant === 'accent') {
    background = 'var(--accent-subtle)';
    color = 'var(--accent-text)';
    border = 'var(--accent-default)';
  }

  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: isSm ? '0.125rem 0.45rem' : '0.2rem 0.6rem',
        fontSize: isSm ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderRadius: 'var(--radius-xs)',
        background,
        color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
