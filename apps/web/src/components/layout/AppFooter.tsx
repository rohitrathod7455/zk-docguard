'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';

export function AppFooter() {
  return (
    <footer
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        padding: '3rem 0 2rem 0',
        marginTop: 'auto',
      }}
    >
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '2rem',
          }}
        >
          {/* Brand & Project Mission */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--accent-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Shield size={14} />
              </div>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: '1rem' }}>
                ZK-DocGuard
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              A Privacy-Preserving Blockchain Document Verification System using Zero-Knowledge Proofs (Groth16 on
              BN254) and Self-Sovereign Identity (W3C Verifiable Credentials).
            </p>
          </div>

          {/* Protocol Standards */}
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
              Cryptographic Standards
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
              <li style={{ color: 'var(--text-muted)' }}>Groth16 SNARK (BN254 curve)</li>
              <li style={{ color: 'var(--text-muted)' }}>Poseidon & BabyJubJub EdDSA</li>
              <li style={{ color: 'var(--text-muted)' }}>W3C VC Data Model 1.1</li>
              <li style={{ color: 'var(--text-muted)' }}>Sparse Merkle Tree (SMT-160)</li>
            </ul>
          </div>

          {/* Quick Links */}
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
              Architecture & Documentation
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
              <li>
                <Link href="/design" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  Component Gallery & Design System
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  How It Works & Cryptographic Protocol
                </Link>
              </li>
              <li>
                <a
                  href="http://localhost:3001/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  REST API & OpenAPI Specs <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Attribution */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>Final Year Major Project & Patent Filing Implementation • Real Benchmarked Cryptography</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>EVM Testnet: Polygon Amoy & Local Node</span>
            <span>Circom 2.1.9 • SnarkJS 0.7.6</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
