'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

export interface ChipProps {
  value?: string;
  label?: string;
  children?: React.ReactNode;
  variant?: string;
  prefixLength?: number;
  suffixLength?: number;
  truncateLength?: number;
  href?: string;
  isMono?: boolean;
}

export function Chip({
  value,
  label,
  children,
  variant: _variant,
  prefixLength = 6,
  suffixLength = 4,
  truncateLength,
  href,
  isMono = true,
}: ChipProps) {
  const displayVal = typeof children === 'string' ? children : (value ?? label ?? (children ? String(children) : ''));
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const finalPrefix = truncateLength ?? prefixLength;
  const finalSuffix = truncateLength ? Math.min(truncateLength, 4) : suffixLength;

  const truncate = (str: string) => {
    if (str.length <= finalPrefix + finalSuffix + 3) return str;
    return `${str.slice(0, finalPrefix)}...${str.slice(-finalSuffix)}`;
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayVal);
      setCopied(true);
      toast.success('Copied to clipboard', truncate(displayVal));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const displayText = truncate(displayVal);

  return (
    <span
      title={displayVal}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.15rem 0.5rem',
        background: 'var(--bg-surface-muted)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xs)',
        fontSize: '0.8125rem',
        color: 'var(--text-primary)',
        fontFamily: isMono ? 'var(--font-mono)' : 'inherit',
        verticalAlign: 'middle',
      }}
    >
      {label && (
        <span
          style={{
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.6875rem',
            marginRight: '2px',
          }}
        >
          {label}:
        </span>
      )}

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent-text)',
            textDecoration: 'none',
          }}
        >
          {displayText}
        </a>
      ) : (
        <span>{displayText}</span>
      )}

      <button
        onClick={handleCopy}
        type="button"
        aria-label="Copy to clipboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: '2px',
          color: copied ? 'var(--status-valid)' : 'var(--text-muted)',
          cursor: 'pointer',
          borderRadius: 'var(--radius-xs)',
        }}
      >
        {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
