import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/'); // Main page is protected
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isOnRegister = nextUrl.pathname.startsWith('/register');

      if (isOnDashboard) {
        if (isOnLogin || isOnRegister) return true; // Allow access to login/register
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
         // if logged in and trying to go to login page, redirect to home? 
         // logic here can be intricate. For now, simple protection.
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
