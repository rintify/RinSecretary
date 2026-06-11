'use client';

import { useMemo, memo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Typography, Divider } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { db } from '@/lib/db';
import { getDayRange } from '@/lib/date-utils';
import EventCard from '@/components/cards/EventCard';
import TaskCard from '@/components/cards/TaskCard';
import AlarmCard from '@/components/cards/AlarmCard';
import EventDialog from '@/components/dialogs/EventDialog';
import type { LocalEvent, LocalTask, LocalAlarm } from '@/lib/db';
import NiceModal from '@ebay/nice-modal-react';

interface DayViewProps {
  date: Date;
  dayStartHour?: number;
  onEventTap?: (event: LocalEvent) => void;
  onTaskTap?: (task: LocalTask) => void;
  onAlarmTap?: (alarm: LocalAlarm) => void;
}

export default memo(
  function DayView({ date, dayStartHour = 4, onEventTap, onTaskTap, onAlarmTap }: DayViewProps) {
    const { start, end } = getDayRange(date, dayStartHour);

    // Dexie.js からリアルタイムにデータ取得
    const events = useLiveQuery(
      () => db.events.where('startAt').between(start, end, true, false).sortBy('startAt'),
      [start.getTime(), end.getTime()],
    );

    const alarms = useLiveQuery(
      () => db.alarms.where('notifyAt').between(start, end, true, false).sortBy('notifyAt'),
      [start.getTime(), end.getTime()],
    );

    const tasks = useLiveQuery(
      () => db.tasks.where('deadline').between(start, end, true, false).sortBy('deadline'),
      [start.getTime(), end.getTime()],
    );

    // イベントとアラームを時刻順に混在表示 (メモ化)
    const timelineItems = useMemo(() => {
      const items: Array<
        { type: 'event'; item: LocalEvent; sortTime: number } | { type: 'alarm'; item: LocalAlarm; sortTime: number }
      > = [];

      events?.forEach((event) => {
        items.push({ type: 'event', item: event, sortTime: event.startAt.getTime() });
      });

      alarms?.forEach((alarm) => {
        items.push({ type: 'alarm', item: alarm, sortTime: alarm.notifyAt.getTime() });
      });

      return items.sort((a, b) => a.sortTime - b.sortTime);
    }, [events, alarms]);

    const dateLabel = useMemo(() => dayjs(date).tz().format('M月D日 (ddd)'), [date]);

    return (
      <Box
        data-testid="day-view"
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: 1.5,
          py: 1,
        }}
      >
        {/* 日付ラベル（ヘッダーにも表示するが、スライド内にも小さく表示） */}
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}
          data-testid="day-view-date-label"
        >
          {dateLabel}
        </Typography>

        {/* タイムライン: イベント + アラーム（時刻順） */}
        {timelineItems.length === 0 && (!tasks || tasks.length === 0) && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.disabled">
              予定はありません
            </Typography>
          </Box>
        )}

        {timelineItems.map((entry) => {
          if (entry.type === 'event') {
            return (
              <EventCard
                key={entry.item.id}
                event={entry.item}
                onTap={onEventTap || (() => NiceModal.show(EventDialog, { editingEventId: entry.item.id }))}
              />
            );
          }
          return <AlarmCard key={entry.item.id} alarm={entry.item} onTap={onAlarmTap} />;
        })}

        {/* タスクセクション */}
        {tasks && tasks.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.5, px: 0.5 }}>
              タスク
            </Typography>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onTap={onTaskTap} />
            ))}
          </>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.date.getTime() === nextProps.date.getTime() && prevProps.dayStartHour === nextProps.dayStartHour;
  },
);
