'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  IconButton,
} from '@mui/material';
import { AccessTime as AccessTimeIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { useDialogStore } from '@/store/dialog';
import { db } from '@/lib/db';
import { createId } from '@paralleldrive/cuid2';
import CustomDatePicker from '../ui/CustomDatePicker';
import CustomTimePicker from '../ui/CustomTimePicker';

// localeをセット
dayjs.locale('ja');

export default function EventDialog() {
  const { isEventDialogOpen, editingEventId, closeEventDialog } = useDialogStore();

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<Date | null>(new Date());
  const [endAt, setEndAt] = useState<Date | null>(new Date());
  const [memo, setMemo] = useState('');

  // Picker State
  const [pickerConfig, setPickerConfig] = useState<{ type: 'date' | 'time'; target: 'start' | 'end' } | null>(null);

  // エラー状態の管理 (dayjsでの比較)
  const isTimeError = startAt && endAt && dayjs(startAt).isAfter(dayjs(endAt).subtract(1, 'ms'));

  // 編集モード時の初期データ読み込み、または新規作成時の初期化
  useEffect(() => {
    if (isEventDialogOpen && editingEventId) {
      db.events.get(editingEventId).then((event) => {
        if (event) {
          setTitle(event.title);
          setStartAt(event.startAt);
          setEndAt(event.endAt);
          setMemo(event.memo || '');
        }
      });
    } else if (isEventDialogOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle('');

      const defaultStart = dayjs.tz().startOf('hour').add(1, 'hour');
      const defaultEnd = defaultStart.add(1, 'hour');

      setStartAt(defaultStart.toDate());
      setEndAt(defaultEnd.toDate());
      setMemo('');
    }
  }, [isEventDialogOpen, editingEventId]);

  const handleSave = async () => {
    if (!title.trim() || !startAt || !endAt || isTimeError) return;

    const now = dayjs().toDate();
    if (editingEventId) {
      await db.events.update(editingEventId, {
        title: title.trim(),
        startAt,
        endAt,
        memo: memo.trim(),
        updatedAt: now,
      });
    } else {
      await db.events.add({
        id: createId(),
        title: title.trim(),
        startAt,
        endAt,
        memo: memo.trim(),
        createdAt: now,
        updatedAt: now,
      });
    }
    closeEventDialog();
  };

  const handleDateSelect = (newDate: Date) => {
    if (!pickerConfig) return;
    const target = pickerConfig.target;
    // Keep existing time (preserve the hours/minutes in the user's timezone)
    const existing = target === 'start' ? startAt : endAt;

    let updatedDate = dayjs.tz(newDate);
    if (existing) {
      const existingTz = dayjs(existing).tz();
      updatedDate = updatedDate.hour(existingTz.hour()).minute(existingTz.minute());
    }

    if (target === 'start') setStartAt(updatedDate.toDate());
    else setEndAt(updatedDate.toDate());

    setPickerConfig(null);
  };

  const handleTimeSelect = (newDate: Date) => {
    if (!pickerConfig) return;
    const target = pickerConfig.target;

    // CustomTimePicker returns the full new Date object
    if (target === 'start') setStartAt(newDate);
    else setEndAt(newDate);

    setPickerConfig(null);
  };

  const getDisplayDateStr = (date: Date | null) => {
    if (!date) return '';
    return dayjs(date).tz().format('YYYY/MM/DD (ddd)');
  };
  const getDisplayTimeStr = (date: Date | null) => {
    if (!date) return '';
    return dayjs(date).tz().format('HH:mm');
  };

  if (isEventDialogOpen) {
    console.log('[DEBUG EventDialog]', {
      title,
      startAt: startAt?.toISOString(),
      endAt: endAt?.toISOString(),
      isTimeError,
      titleTrimmed: !!title.trim(),
    });
  }

  return (
    <Dialog open={isEventDialogOpen} onClose={closeEventDialog} maxWidth="sm" fullWidth>
      <DialogTitle>{editingEventId ? 'イベントを編集' : 'イベントを作成'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <TextField
            label="タイトル (最大50文字)"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 50, 'data-testid': 'event-title-input' }}
            required
            autoFocus
          />

          <Stack spacing={2} direction="column">
            {/* Start Time */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                開始日時
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                <Typography
                  variant="body1"
                  sx={{ mr: 1, cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                  onClick={() => setPickerConfig({ type: 'date', target: 'start' })}
                  data-testid="event-start-date-text"
                >
                  {getDisplayDateStr(startAt)} {getDisplayTimeStr(startAt)}
                </Typography>
                <IconButton
                  onClick={() => setPickerConfig({ type: 'time', target: 'start' })}
                  size="small"
                  sx={{ color: 'primary.main' }}
                  data-testid="event-start-time-btn"
                >
                  <AccessTimeIcon />
                </IconButton>
              </Box>
              {/* test helper input (visually hidden) */}
              <input
                type="text"
                style={{ display: 'none' }}
                data-testid="event-start-input"
                value={startAt ? dayjs(startAt).tz().format('YYYY-MM-DDTHH:mm') : ''}
                onChange={(e) => {
                  const d = dayjs.tz(e.target.value);
                  if (d.isValid()) setStartAt(d.toDate());
                }}
              />
            </Box>

            {/* End Time */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                終了日時
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0 }}>
                <Typography
                  variant="body1"
                  sx={{
                    mr: 1,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.7 },
                    color: isTimeError ? 'error.main' : 'inherit',
                  }}
                  onClick={() => setPickerConfig({ type: 'date', target: 'end' })}
                  data-testid="event-end-date-text"
                >
                  {getDisplayDateStr(endAt)} {getDisplayTimeStr(endAt)}
                </Typography>
                <IconButton
                  onClick={() => setPickerConfig({ type: 'time', target: 'end' })}
                  size="small"
                  sx={{ color: 'primary.main' }}
                  data-testid="event-end-time-btn"
                >
                  <AccessTimeIcon />
                </IconButton>
              </Box>
              {isTimeError && (
                <Typography variant="caption" color="error">
                  終了日時は開始日時より後に設定してください
                </Typography>
              )}
              {/* test helper input (visually hidden) */}
              <input
                type="text"
                style={{ display: 'none' }}
                data-testid="event-end-input"
                value={endAt ? dayjs(endAt).tz().format('YYYY-MM-DDTHH:mm') : ''}
                onChange={(e) => {
                  const d = dayjs.tz(e.target.value);
                  if (d.isValid()) setEndAt(d.toDate());
                }}
              />
            </Box>
          </Stack>

          <CustomDatePicker
            open={pickerConfig?.type === 'date'}
            onClose={() => setPickerConfig(null)}
            value={pickerConfig?.target === 'start' ? startAt || new Date() : endAt || new Date()}
            onChange={handleDateSelect}
          />

          <CustomTimePicker
            open={pickerConfig?.type === 'time'}
            onClose={() => setPickerConfig(null)}
            value={pickerConfig?.target === 'start' ? startAt || new Date() : endAt || new Date()}
            onChange={handleTimeSelect}
          />

          <TextField
            label="メモ"
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            inputProps={{ 'data-testid': 'event-memo-input' }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeEventDialog} data-testid="event-cancel-button">
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!title.trim() || !startAt || !endAt || !!isTimeError}
          data-testid="event-save-button"
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
