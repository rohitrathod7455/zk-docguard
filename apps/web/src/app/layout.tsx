import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { serifFont, sansFont, monoFont } from './fonts';
import '../styles/globals.css';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import { WalletProvider } from '../components/auth/WalletContext';
import { ToastProvider } from '../components/ui/Toast';
import { AppHeader } from '../components/layout/AppHeader';
import { AppNavigation } from '../components/layout/AppNavigation';
import { AppFooter } from '../components/layout/AppFooter';

export const metadata: Metadata = {
  title: 'ZK-DocGuard — Privacy-Preserving Blockchain Document Verification',
  description:
    'Institutional document verification system using Zero-Knowledge proofs (Groth16 on BN254) and Self-Sovereign Identity on EVM.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${serifFont.variable} ${sansFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <ThemeProvider>
          <WalletProvider>
            <ToastProvider>
              <AppHeader />
              <AppNavigation />
              <main style={{ flex: 1, paddingBottom: '3rem' }}>{children}</main>
              <AppFooter />
            </ToastProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
