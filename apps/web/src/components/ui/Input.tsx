'use client';

import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  helperText?: string;
  error?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, helperText, error, leftAddon, rightAddon, id, style, ...props }, ref) => {
    const finalHint = hint ?? helperText;
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {label}
          </label>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--status-revoked)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          {leftAddon && (
            <div
              style={{
                padding: '0 0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface-muted)',
                borderRight: '1px solid var(--border-default)',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
              }}
            >
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            style={{
              flex: 1,
              height: '38px',
              padding: '0 0.75rem',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              width: '100%',
              ...style,
            }}
            {...props}
          />

          {rightAddon && (
            <div
              style={{
                padding: '0 0.75rem',
                color: 'var(--text-muted)',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {rightAddon}
            </div>
          )}
        </div>

        {finalHint && !error && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{finalHint}</span>
        )}

        {error && (
          <span style={{ fontSize: '0.75rem', color: 'var(--status-revoked)', fontWeight: 500 }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
