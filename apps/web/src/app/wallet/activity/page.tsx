'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  FileCheck2,
  Sparkles,
  Download,
  KeyRound,
  Clock,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { isVaultUnlocked, getUnlockedVault, ActivityItem } from '../../../lib/vault';

export default function ActivityPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    if (isVaultUnlocked()) {
      setUnlocked(true);
      const vault = getUnlockedVault();
      setActivities(vault.activities || []);
    }
  }, []);

  if (!unlocked) {
    return (
      <div className="app-container" style={{ padding: '4rem 1.5rem', maxWidth: '520px' }}>
        <Card title="Wallet Locked" subtitle="Please unlock your wallet to view your activity history">
          <Link href="/wallet" style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ width: '100%' }}>
              Unlock Wallet
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const filtered = selectedType === 'ALL'
    ? activities
    : activities.filter((a) => a.type === selectedType);

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'CREDENTIAL_RECEIVED':
        return <FileCheck2 size={16} style={{ color: 'var(--color-success)' }} />;
      case 'PROOF_GENERATED':
        return <Sparkles size={16} style={{ color: 'var(--accent-default)' }} />;
      case 'BACKUP_EXPORTED':
        return <Download size={16} style={{ color: 'var(--text-secondary)' }} />;
      case 'KEY_INITIALIZED':
        return <KeyRound size={16} style={{ color: 'var(--color-warning)' }} />;
    }
  };

  return (
    <div className="app-container" style={{ padding: '2rem 1.5rem', maxWidth: '840px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.75rem',
              fontWeight: 600,
              marginBottom: '0.375rem',
            }}
          >
            Holder Activity Audit Log
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Cryptographically logged interactions, zero-knowledge proofs generated, and credentials received.
          </p>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['ALL', 'PROOF_GENERATED', 'CREDENTIAL_RECEIVED', 'BACKUP_EXPORTED'].map((t) => (
            <Button
              key={t}
              variant={selectedType === t ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedType(t)}
            >
              {t.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <Card title="Activity Timeline" subtitle={`${filtered.length} Recorded Events`}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <History size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p>No activity records matching this filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getTypeIcon(item.type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
