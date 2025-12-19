'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { createTheme } from '@mui/material/styles';
import { Roboto } from 'next/font/google';
import DataUsageTracker from './components/DataUsageTracker';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  spacing: 6.4, // Scaled down from 8px (0.8x)
  typography: {
    fontFamily: roboto.style.fontFamily,
  },
  palette: {
    mode: 'light',
    // Customized to match the "clean white" aesthetic requested previously, but using MUI tokens
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    primary: {
      main: '#1976d2', // Standard Blue, can be adjusted
    },
    secondary: {
      main: '#9c27b0',
    },
  },
  components: {
     MuiCssBaseline: {
       styleOverrides: {
         html: {
           fontSize: '80%', // Scaled down from default (~100% or 16px) to ~12.8px (0.8x) to affect rem values
         },
         // NEW: Force inputs to 16px to prevent iOS zoom
         'input, textarea, select': {
           fontSize: '16px !important', 
         },
       },
     },
     MuiAppBar: {
      styleOverrides: {
        root: {
            backgroundColor: 'rgba(255,255,255,0.8)',
            color: '#333',
            backdropFilter: 'blur(8px)',
            boxShadow: 'none',
            borderBottom: '1px solid #eee'
        }
      }
     }
  }
});

// Global styles for user-select
const globalUserSelectStyles = {
  '*, *::before, *::after': {
    WebkitUserSelect: 'none !important',
    MozUserSelect: 'none !important',
    msUserSelect: 'none !important',
    userSelect: 'none !important',
  },
  'input, textarea, [contenteditable="true"]': {
    WebkitUserSelect: 'text !important',
    MozUserSelect: 'text !important',
    msUserSelect: 'text !important',
    userSelect: 'text !important',
  },
  '.selectable-text, .selectable-text *': {
    WebkitUserSelect: 'text !important',
    MozUserSelect: 'text !important',
    msUserSelect: 'text !important',
    userSelect: 'text !important',
    cursor: 'text',
  },
};

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={globalUserSelectStyles} />
        <DataUsageTracker />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

