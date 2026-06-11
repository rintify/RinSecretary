'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import NiceModal from '@ebay/nice-modal-react';

const theme = createTheme({
  spacing: 6.4,
  palette: {
    mode: 'light',
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          fontSize: '80%',
        },
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
          borderBottom: '1px solid #eee',
        },
      },
    },
  },
});

const globalUserSelectStyles = {
  '*, *::before, *::after': {
    WebkitUserSelect: 'none !important' as const,
    MozUserSelect: 'none !important' as const,
    msUserSelect: 'none !important' as const,
    userSelect: 'none !important' as const,
  },
  'input, textarea, [contenteditable="true"]': {
    WebkitUserSelect: 'text !important' as const,
    MozUserSelect: 'text !important' as const,
    msUserSelect: 'text !important' as const,
    userSelect: 'text !important' as const,
  },
  '.selectable-text, .selectable-text *': {
    WebkitUserSelect: 'text !important' as const,
    MozUserSelect: 'text !important' as const,
    msUserSelect: 'text !important' as const,
    userSelect: 'text !important' as const,
    cursor: 'text',
  },
};

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <NiceModal.Provider>
          <CssBaseline />
          <GlobalStyles styles={globalUserSelectStyles} />
          {children}
        </NiceModal.Provider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
