'use client';

// Removed unnecessary hooks for form state since we just trigger a Google sign-in
import { authenticate } from '@/lib/actions';
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

export default function LoginPage() {
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
    </div>
  );
}
