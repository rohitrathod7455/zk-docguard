'use client';

import React, { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        borderBottom: '1px solid var(--border-default)',
        background: 'transparent',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--accent-default)' : 'transparent'}`,
              marginBottom: '-1px',
              cursor: 'pointer',
              transition: 'color var(--transition-fast), border-color var(--transition-fast)',
              userSelect: 'none',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--accent-subtle)' : 'var(--bg-surface-muted)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
