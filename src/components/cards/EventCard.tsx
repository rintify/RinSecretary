'use client';

import { format } from 'date-fns';
import { Box, Typography, Chip } from '@mui/material';
import { EVENT_COLOR } from '@/lib/colors';
import type { LocalEvent } from '@/lib/db';

interface EventCardProps {
  event: LocalEvent;
  onTap?: (event: LocalEvent) => void;
}

export default function EventCard({ event, onTap }: EventCardProps) {
  const startTime = format(event.startAt, 'HH:mm');
  const endTime = format(event.endAt, 'HH:mm');

  return (
    <Box
      data-testid={`event-card-${event.id}`}
      onClick={() => onTap?.(event)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        borderLeft: `4px solid ${EVENT_COLOR}`,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: onTap ? 'pointer' : 'default',
        mb: 0.5,
      }}
    >
      <Chip
        label={`${startTime}–${endTime}`}
        size="small"
        sx={{
          bgcolor: `${EVENT_COLOR}22`,
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
        {event.title}
      </Typography>
    </Box>
  );
}
