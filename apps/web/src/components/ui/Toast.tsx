'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
  };
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  },
  showToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, type, title, description };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (title: string, description?: string) => addToast('success', title, description),
    error: (title: string, description?: string) => addToast('error', title, description),
    info: (title: string, description?: string) => addToast('info', title, description),
    warning: (title: string, description?: string) => addToast('warning', title, description),
  };

  return (
    <ToastContext.Provider value={{ toast, showToast: addToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '380px',
          width: '100%',
        }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const borderColor = isSuccess
            ? 'var(--status-valid-border)'
            : isError
              ? 'var(--status-revoked-border)'
              : 'var(--status-info-border)';
          const bgColor = isSuccess
            ? 'var(--status-valid-bg)'
            : isError
              ? 'var(--status-revoked-bg)'
              : 'var(--status-info-bg)';
          const textColor = isSuccess
            ? 'var(--status-valid)'
            : isError
              ? 'var(--status-revoked)'
              : 'var(--status-info)';

          return (
            <div
              key={t.id}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                color: 'var(--text-primary)',
                animation: 'fadeIn 150ms ease-out',
              }}
            >
              <div style={{ color: textColor, marginTop: '2px', flexShrink: 0 }}>
                {isSuccess && <CheckCircle2 size={18} strokeWidth={2} />}
                {isError && <AlertCircle size={18} strokeWidth={2} />}
                {!isSuccess && !isError && <Info size={18} strokeWidth={2} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.title}</div>
                {t.description && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {t.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
