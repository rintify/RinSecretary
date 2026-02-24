'use client';

import { Box, Fab } from '@mui/material';
import {
  Event as EventIcon,
  TaskAlt as TaskIcon,
  Note as MemoIcon,
  Notifications as AlarmIcon,
} from '@mui/icons-material';
import { EVENT_COLOR, TASK_COLOR, ALARM_COLOR, MEMO_COLOR } from '@/lib/colors';

export type FabAction = 'NEW_TASK' | 'NEW_EVENT' | 'NEW_ALARM' | 'MEMOS';

interface ActionFabsProps {
  onAction: (action: FabAction) => void;
}

export default function ActionFabs({ onAction }: ActionFabsProps) {
  return (
    <Box
      data-testid="action-fabs"
      sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        alignItems: 'center',
        zIndex: 100,
      }}
    >
      <Fab
        data-testid="fab-new-task"
        aria-label="新しいタスク"
        onClick={() => onAction('NEW_TASK')}
        size="medium"
        sx={{ bgcolor: TASK_COLOR, color: '#fff' }}
      >
        <TaskIcon />
      </Fab>
      <Fab
        data-testid="fab-new-event"
        aria-label="新しいイベント"
        onClick={() => onAction('NEW_EVENT')}
        size="medium"
        sx={{ bgcolor: EVENT_COLOR, color: '#fff' }}
      >
        <EventIcon />
      </Fab>
      <Fab
        data-testid="fab-new-alarm"
        aria-label="新しいアラーム"
        onClick={() => onAction('NEW_ALARM')}
        size="medium"
        sx={{ bgcolor: ALARM_COLOR, color: '#fff' }}
      >
        <AlarmIcon />
      </Fab>
      <Fab
        data-testid="fab-memos"
        aria-label="メモ一覧"
        onClick={() => onAction('MEMOS')}
        size="medium"
        sx={{ bgcolor: MEMO_COLOR, color: '#fff' }}
      >
        <MemoIcon />
      </Fab>
    </Box>
  );
}
