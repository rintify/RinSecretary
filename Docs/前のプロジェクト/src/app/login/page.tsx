'use client';

// Removed unnecessary hooks for form state since we just trigger a Google sign-in
import { authenticate, skipAuth } from '@/lib/actions';
import { useFormStatus } from 'react-dom';

function GoogleSignInButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'var(--color-text)',
        color: 'var(--color-bg)',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {pending ? 'Connecting...' : 'Sign in with Google'}
    </button>
  );
}

function DevSkipButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid var(--color-text)',
        borderRadius: '8px',
        fontSize: '14px',
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.7 : 0.8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {pending ? 'Loading...' : '🛠️ 開発モード（認証スキップ）'}
    </button>
  );
}

export default function LoginPage() {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100dvh',
      padding: '20px',
      backgroundColor: 'var(--color-bg)',
    }}>
      <h1 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>RinSecretary</h1>
      <form action={authenticate} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <GoogleSignInButton />
      </form>
      
      {/* 開発モードの場合のみスキップボタンを表示 */}
      {isDev && (
        <form action={skipAuth} style={{ width: '100%', maxWidth: '320px', marginTop: '16px' }}>
          <DevSkipButton />
        </form>
      )}
    </div>
  );
}
