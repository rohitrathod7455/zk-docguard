'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet, UserRole } from '../auth/WalletContext';

interface NavItem {
  label: string;
  href: string;
}

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  public: [
    { label: 'Overview', href: '/' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Verify Document', href: '/verify' },
  ],
  issuer: [
    { label: 'Console Overview', href: '/issuer' },
    { label: 'Issue Credential', href: '/issuer/issue' },
    { label: 'Batch Issuance', href: '/issuer/batch' },
    { label: 'Issued Registry', href: '/issuer/credentials' },
    { label: 'Key Rotation', href: '/issuer/keys' },
  ],
  holder: [
    { label: 'Identity Wallet', href: '/wallet' },
    { label: 'Present ZK Proof', href: '/wallet/present' },
    { label: 'Audit Activity', href: '/wallet/activity' },
    { label: 'Vault Backup', href: '/wallet/backup' },
  ],
  verifier: [
    { label: 'New Verification Request', href: '/verifier' },
    { label: 'Active Sessions & SSE', href: '/verifier/sessions' },
    { label: 'Verification Log', href: '/verifier/history' },
  ],
  admin: [
    { label: 'Registry Overview', href: '/admin' },
    { label: 'Institutional Applicants', href: '/admin/issuers' },
    { label: 'System Audit Logs', href: '/admin/audit' },
  ],
};

export function AppNavigation() {
  const { role } = useWallet();
  const pathname = usePathname();
  const items = ROLE_NAV[role] || ROLE_NAV.public;

  return (
    <nav
      style={{
        background: 'var(--bg-surface-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="app-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          height: '42px',
          overflowX: 'auto',
        }}
      >
        {items.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                textDecoration: 'none',
                height: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                borderBottom: `2px solid ${isActive ? 'var(--accent-default)' : 'transparent'}`,
                whiteSpace: 'nowrap',
                transition: 'color var(--transition-fast), border-color var(--transition-fast)',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
