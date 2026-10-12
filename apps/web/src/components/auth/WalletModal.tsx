'use client';

import React from 'react';
import { User, Check, LogOut } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { useWallet, DEMO_ACCOUNTS, DemoAccount } from './WalletContext';

export interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { address, isConnected, role, connectDemoAccount, disconnect } = useWallet();

  const handleSelectAccount = (acc: DemoAccount) => {
    connectDemoAccount(acc);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Institutional Identity"
      description="Connect via browser wallet or choose a pre-configured role identity for demonstration."
      maxWidth="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {isConnected && address && (
          <div
            style={{
              padding: '1rem',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-default)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Currently Active
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Role: <span style={{ textTransform: 'capitalize' }}>{role}</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                <Chip value={address} prefixLength={8} suffixLength={6} />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                disconnect();
                onClose();
              }}
              leftIcon={<LogOut size={14} />}
            >
              Disconnect
            </Button>
          </div>
        )}

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
              marginBottom: '0.75rem',
            }}
          >
            Demo Role Personas (One-Click Testing)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = address?.toLowerCase() === acc.address.toLowerCase();

              return (
                <button
                  key={acc.address}
                  onClick={() => handleSelectAccount(acc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: isSelected ? 'var(--bg-surface-active)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${isSelected ? 'var(--accent-default)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-surface-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <User size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {acc.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {acc.address.slice(0, 10)}...{acc.address.slice(-6)}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check size={16} color="var(--accent-text)" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
