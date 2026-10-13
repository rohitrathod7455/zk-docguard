'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifierSessionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/verifier/history');
  }, [router]);

  return (
    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Redirecting to session log...
    </div>
  );
}
