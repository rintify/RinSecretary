'use client';

import { format } from 'date-fns';
import { Box, Typography, Chip } from '@mui/material';
import { TASK_COLOR } from '@/lib/colors';
import type { LocalTask } from '@/lib/db';

interface TaskCardProps {
  task: LocalTask;
  onTap?: (task: LocalTask) => void;
}

export default function TaskCard({ task, onTap }: TaskCardProps) {
  const deadlineTime = format(task.deadline, 'HH:mm');

  return (
    <Box
      data-testid={`task-card-${task.id}`}
      onClick={() => onTap?.(task)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderLeft: `4px solid ${TASK_COLOR}`,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: onTap ? 'pointer' : 'default',
        mb: 0.5,
      }}
    >
      <Chip
        label={`〆 ${deadlineTime}`}
        size="small"
        sx={{
          bgcolor: `${TASK_COLOR}22`,
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: '0.75rem',
          height: 24,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {task.title}
      </Typography>
    </Box>
  );
}
