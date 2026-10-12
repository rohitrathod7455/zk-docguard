'use client';

import React, { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const finalLoading = isLoading || loading;
    const isSecondary = variant === 'secondary';
    const isOutline = variant === 'outline';
    const isDanger = variant === 'danger';
    const isGhost = variant === 'ghost';

    // Padding & font size by size
    let padding = '0.5rem 1rem';
    let fontSize = '0.875rem';
    let height = '36px';

    if (size === 'sm') {
      padding = '0.35rem 0.75rem';
      fontSize = '0.8125rem';
      height = '30px';
    } else if (size === 'lg') {
      padding = '0.65rem 1.25rem';
      fontSize = '1rem';
      height = '44px';
    }

    // Styles by variant
    let background = 'var(--accent-default)';
    let color = '#FFFFFF';
    let border = '1px solid transparent';

    if (isSecondary || isOutline) {
      background = 'var(--bg-surface)';
      color = 'var(--text-primary)';
      border = '1px solid var(--border-default)';
    } else if (isDanger) {
      background = 'var(--status-revoked)';
      color = '#FFFFFF';
      border = '1px solid transparent';
    } else if (isGhost) {
      background = 'transparent';
      color = 'var(--text-primary)';
      border = '1px solid transparent';
    }

    return (
      <button
        ref={ref}
        disabled={disabled || finalLoading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          height,
          padding,
          fontSize,
          fontWeight: 500,
          fontFamily: 'inherit',
          borderRadius: 'var(--radius-md)',
          background,
          color,
          border,
          cursor: disabled || finalLoading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'background var(--transition-fast), border-color var(--transition-fast), opacity var(--transition-fast)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          ...style,
        }}
        {...props}
      >
        {finalLoading && <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />}
        {!finalLoading && leftIcon}
        <span>{children}</span>
        {!finalLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
