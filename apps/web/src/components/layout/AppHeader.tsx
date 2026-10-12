'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Sun, Moon, Wallet, Layers, ChevronDown } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useWallet, UserRole, SUPPORTED_NETWORKS } from '../auth/WalletContext';
import { Button } from '../ui/Button';
import { WalletModal } from '../auth/WalletModal';

const ROLE_LABELS: Record<UserRole, string> = {
  public: 'Public',
  issuer: 'Issuer Console',
  holder: 'Holder Wallet',
  verifier: 'Verifier',
  admin: 'Registry Admin',
};

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { role, setRole, address, isConnected, chainId } = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const network = SUPPORTED_NETWORKS[chainId] || { name: `Chain ${chainId}`, chainId };

  return (
    <>
      <header
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          position: 'sticky',
          top: 0,
          zIndex: 8000,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          className="app-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            gap: '1rem',
          }}
        >
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--accent-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Shield size={18} strokeWidth={2} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  ZK-DocGuard
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Privacy-Preserving SSI
                </span>
              </div>
            </Link>

            {/* Network Status Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.2rem 0.5rem',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--status-valid)',
                }}
              />
              <span>{network.name}</span>
            </div>
          </div>

          {/* Right Header Controls: Role Selector, Design Link, Theme, Wallet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Role Switcher */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                }}
              >
                <span>Role: {ROLE_LABELS[role]}</span>
                <ChevronDown size={14} color="var(--text-muted)" />
              </button>

              {isRoleDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    width: '180px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.25rem',
                    zIndex: 9000,
                  }}
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setIsRoleDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        fontSize: '0.8125rem',
                        fontWeight: role === r ? 600 : 400,
                        color: role === r ? 'var(--accent-text)' : 'var(--text-primary)',
                        background: role === r ? 'var(--accent-subtle)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        cursor: 'pointer',
                      }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Design System Link */}
            <Link
              href="/design"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.35rem 0.65rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                background: 'transparent',
              }}
            >
              <Layers size={14} />
              <span>Design System</span>
            </Link>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Wallet Connect / Identity Button */}
            <Button
              variant={isConnected ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setIsWalletModalOpen(true)}
              leftIcon={<Wallet size={14} />}
            >
              {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </header>

      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
    </>
  );
}
