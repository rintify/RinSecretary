'use server';

import { signIn } from '@/auth';

export async function authenticate() {
  await signIn('google', { redirectTo: '/' });
}


// Register function removed as we only use Google Auth

import { signOut } from '@/auth';

export async function logout() {
  await signOut({ redirectTo: '/login' });
}


