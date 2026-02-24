import { useState, useEffect } from 'react';
import { Dialog, DialogContent, IconButton, Typography, Box, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight, Today } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ja';

interface CustomDatePickerProps {
  open: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  accentColor?: string;
}

export default function CustomDatePicker({ open, onClose, value, onChange, accentColor }: CustomDatePickerProps) {
  // 内部状態はDayjsオブジェクトで持つ
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(dayjs.tz());
  const theme = useTheme();

  const mainColor = accentColor || theme.palette.primary.main;

  useEffect(() => {
    if (open && value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentMonth(dayjs(value).tz());
    }
  }, [open, value]);

  const handlePrevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const handleNextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));
  const handleJumpToToday = () => {
    const today = dayjs.tz();
    setCurrentMonth(today);
    onChange(today.toDate());
    onClose();
  };

  const handleDateClick = (day: Dayjs) => {
    // 既存の時間と分を保持したまま日付を更新
    const newDate = dayjs(value).tz().year(day.year()).month(day.month()).date(day.date());

    onChange(newDate.toDate());
    onClose();
  };

  const renderHeader = () => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <IconButton onClick={handlePrevMonth}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" fontWeight="bold">
          {currentMonth.format('YYYY年 M月')}
        </Typography>
        <Box>
          <IconButton onClick={handleJumpToToday} sx={{ mr: 1, color: mainColor }}>
            <Today />
          </IconButton>
          <IconButton onClick={handleNextMonth}>
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>
    );
  };

  const renderDays = () => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
        {days.map((day, index) => (
          <Typography
            key={day}
            align="center"
            variant="caption"
            fontWeight="bold"
            color={index === 0 ? 'error.main' : index === 6 ? 'primary.main' : 'text.secondary'}
          >
            {day}
          </Typography>
        ))}
      </Box>
    );
  };

  const renderCells = () => {
    const monthStart = currentMonth.startOf('month');
    const monthEnd = currentMonth.endOf('month');
    const startDate = monthStart.startOf('week');
    const endDate = monthEnd.endOf('week');

    const rows = [];
    let days = [];
    let day = startDate;

    const today = dayjs.tz();
    const targetValue = dayjs(value).tz();

    // dayjsはミュータブルではないが、比較のために同等ロジックを構成する
    while (day.isBefore(endDate) || day.isSame(endDate, 'day')) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = day.format('D');
        const cloneDay = day; // dayjsオブジェクトの参照を持っておく

        const isSelected = day.isSame(targetValue, 'day');
        const isCurrentMonth = day.isSame(monthStart, 'month');
        const isDayToday = day.isSame(today, 'day');

        days.push(
          <Box
            key={day.toISOString()}
            onClick={() => handleDateClick(cloneDay)}
            sx={{
              width: '100%',
              maxWidth: '40px',
              aspectRatio: '1/1',
              margin: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '50%',
              bgcolor: isSelected ? mainColor : 'transparent',
              color: isSelected ? '#fff' : !isCurrentMonth ? 'text.disabled' : isDayToday ? mainColor : 'text.primary',
              fontWeight: isSelected || isDayToday ? 'bold' : 'normal',
              border: isDayToday && !isSelected ? `1px solid ${mainColor}` : 'none',
              '&:hover': {
                bgcolor: isSelected ? mainColor : 'action.hover',
                opacity: isSelected ? 0.9 : 1,
              },
            }}
          >
            {formattedDate}
          </Box>,
        );
        day = day.add(1, 'day');
      }
      rows.push(
        <Box
          key={day.toISOString() + '_row'}
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5 }}
        >
          {days}
        </Box>,
      );
      days = [];
    }
    return <Box>{rows}</Box>;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '95%',
          maxWidth: '400px',
          borderRadius: 3,
          p: 1,
          m: 'auto',
        },
      }}
    >
      <DialogContent>
        {renderHeader()}
        {renderDays()}
        {renderCells()}
      </DialogContent>
    </Dialog>
  );
}
