'use client';

import dayjs from 'dayjs';
import { Box, Typography } from '@mui/material';
import { Notifications as AlarmIcon } from '@mui/icons-material';
import { ALARM_COLOR } from '@/lib/colors';
import type { LocalAlarm } from '@/lib/db';

interface AlarmCardProps {
  alarm: LocalAlarm;
  onTap?: (alarm: LocalAlarm) => void;
}

/** アラームカード: 枠無しでスペースを取らないシンプルなデザイン */
export default function AlarmCard({ alarm, onTap }: AlarmCardProps) {
  const notifyTime = dayjs(alarm.notifyAt).tz().format('HH:mm');

  return (
    <Box
      data-testid={`alarm-card-${alarm.id}`}
      onClick={() => onTap?.(alarm)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.5,
        cursor: onTap ? 'pointer' : 'default',
        opacity: alarm.isSent ? 0.5 : 1,
        mb: 0.25,
      }}
    >
      <AlarmIcon sx={{ fontSize: 16, color: ALARM_COLOR }} />
      <Typography variant="caption" sx={{ color: ALARM_COLOR, fontWeight: 600, flexShrink: 0 }}>
        {notifyTime}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {alarm.title}
      </Typography>
    </Box>
  );
}
