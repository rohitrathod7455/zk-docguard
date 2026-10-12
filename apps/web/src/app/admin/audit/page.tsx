'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { Badge } from '../../../components/ui/Badge';
import { ArrowLeft, Clock, Shield } from 'lucide-react';

interface AuditItem {
  id: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}

const SAMPLE_LOGS: AuditItem[] = [
  {
    id: 'log-1',
    action: 'ISSUER_APPROVED',
    actor: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    details: 'Approved Northfield University Registrar on IssuerRegistry.sol (Tx: 0x7a8b...12ef)',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'log-2',
    action: 'CREDENTIAL_ANCHORED',
    actor: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    details: 'Anchored DocumentRegistry Record (DocHash: 0xaa12...bb34, CredId: 0xbb45...cc67)',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'log-3',
    action: 'BATCH_CREDENTIAL_ANCHORED',
    actor: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    details: 'Anchored 50-record graduation cohort root 0x55aa...99bb to DocumentRegistry.sol',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'log-4',
    action: 'ISSUER_KEY_ROTATED',
    actor: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    details: 'BabyJubJub proving key rotated to Epoch 2; 90-day grace period initiated',
    timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
  {
    id: 'log-5',
    action: 'ISSUER_APPLICATION_SUBMITTED',
    actor: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    details: 'Submitted institutional onboarding application with did:ethr:31337:0x7099...79c8',
    timestamp: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
  },
];

export default function AdminAuditPage() {
  const [logs] = useState<AuditItem[]>(SAMPLE_LOGS);

  return (
    <div className="app-container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            textDecoration: 'none',
            marginBottom: '0.75rem',
          }}
        >
          <ArrowLeft size={14} /> Back to Registry Overview
        </Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: 0, fontWeight: 500 }}>
          System Audit & Protocol Governance Logs
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Cryptographically immutable activity trail of administrative approvals, key rotations, and anchor transactions.
        </p>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hairline-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Protocol Event</th>
              <th>Actor (Signer)</th>
              <th>Details & Cryptographic Digest</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </td>
                <td>
                  <Badge variant={log.action.includes('APPROVED') || log.action.includes('ANCHORED') ? 'valid' : 'accent'}>
                    <Shield size={10} style={{ marginRight: '0.25rem' }} />
                    {log.action}
                  </Badge>
                </td>
                <td>
                  <Chip value={log.actor} truncateLength={6} />
                </td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
