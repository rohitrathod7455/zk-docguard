'use client';

import React, { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, id, style, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
        {label && (
          <label
            htmlFor={selectId}
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
            position: 'relative',
            background: 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--status-revoked)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <select
            ref={ref}
            id={selectId}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 2rem 0 0.75rem',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              appearance: 'none',
              cursor: 'pointer',
              ...style,
            }}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
          >
            ▼
          </div>
        </div>

        {hint && !error && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>
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

Select.displayName = 'Select';
