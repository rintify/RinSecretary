'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Box,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Work as JobIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';

interface AppHeaderProps {
  currentDate: Date;
  onDateTap?: () => void;
}

/** 同期ステータスの色（スタブ: 常にグレー） */
const SYNC_STATUS_COLOR = '#9e9e9e';

export default function AppHeader({ currentDate, onDateTap }: AppHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dateLabel = format(currentDate, 'MM/dd (E)', { locale: ja });

  return (
    <>
      <Box
        data-testid="app-header"
        sx={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
          zIndex: 1200,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        {/* 左: 日付 + 同期インジケーター */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h6"
            data-testid="header-date"
            onClick={onDateTap}
            sx={{
              fontWeight: 'bold',
              cursor: onDateTap ? 'pointer' : 'default',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {dateLabel}
          </Typography>
          <DotIcon data-testid="sync-status-indicator" sx={{ fontSize: 12, color: SYNC_STATUS_COLOR }} />
        </Box>

        {/* 右: ハンバーガーメニュー */}
        <IconButton data-testid="menu-button" onClick={() => setDrawerOpen(true)} edge="end">
          <MenuIcon />
        </IconButton>
      </Box>

      {/* ナビゲーションドロワー */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box
          data-testid="navigation-drawer"
          sx={{ width: 280 }}
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <List>
            <ListItem disablePadding>
              <ListItemButton data-testid="menu-settings">
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="設定" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton data-testid="menu-jobs">
                <ListItemIcon>
                  <JobIcon />
                </ListItemIcon>
                <ListItemText primary="ジョブ管理" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                data-testid="menu-logout"
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.href = '/login';
                  } catch {
                    // ignore
                  }
                }}
              >
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="ログアウト" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
