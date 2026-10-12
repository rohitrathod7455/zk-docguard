'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Check } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';

export interface QRCodeDisplayProps {
  payload: string;
  size?: number;
  label?: string;
}

export function QRCodeDisplay({ payload, size = 220, label }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current && payload) {
      QRCode.toCanvas(canvasRef.current, payload, {
        width: size,
        margin: 2,
        color: {
          dark: '#15181D',
          light: '#FFFFFF',
        },
      }).catch((err) => {
        console.error('Failed to render QR code:', err);
      });
    }
  }, [payload, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success('QR payload copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `zk-docguard-qr-${Date.now()}.png`;
      a.click();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.25rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        maxWidth: `${size + 50}px`,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          padding: '0.75rem',
          background: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
      </div>

      {label && (
        <span
          style={{
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            wordBreak: 'break-all',
          }}
        >
          {label}
        </span>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginTop: '1rem',
          width: '100%',
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          style={{ flex: 1 }}
          leftIcon={copied ? <Check size={14} color="var(--status-valid)" /> : <Copy size={14} />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          style={{ flex: 1 }}
          leftIcon={<Download size={14} />}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
