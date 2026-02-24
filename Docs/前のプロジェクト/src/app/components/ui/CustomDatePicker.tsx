import { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogContent, 
    IconButton, 
    Typography, 
    Box, 
    Grid,
    Button,
    useTheme
} from '@mui/material';
import { 
    ChevronLeft, 
    ChevronRight, 
    Today 
} from '@mui/icons-material';
import { 
    format, 
    addMonths, 
    subMonths, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    addDays, 
    isSameMonth, 
    isSameDay, 
    isToday 
} from 'date-fns';
import { ja } from 'date-fns/locale';

interface CustomDatePickerProps {
    open: boolean;
    onClose: () => void;
    value: Date;
    onChange: (date: Date) => void;
    accentColor?: string;
}

export default function CustomDatePicker({ open, onClose, value, onChange, accentColor }: CustomDatePickerProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const theme = useTheme();

    // Use passed accentColor or fallback to theme primary
    const mainColor = accentColor || theme.palette.primary.main;

    useEffect(() => {
        if (open && value) {
            setCurrentMonth(value);
        }
    }, [open, value]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const handleJumpToToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        onChange(today);
        onClose();
    };

    const handleDateClick = (day: Date) => {
        const newDate = new Date(value);
        newDate.setFullYear(day.getFullYear());
        newDate.setMonth(day.getMonth());
        newDate.setDate(day.getDate());
        
        onChange(newDate);
        onClose();
    };

    const renderHeader = () => {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <IconButton onClick={handlePrevMonth}>
                    <ChevronLeft />
                </IconButton>
                <Typography variant="h6" fontWeight="bold">
                    {format(currentMonth, 'yyyy年 M月', { locale: ja })}
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
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = '';

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isSelected = isSameDay(day, value);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isDayToday = isToday(day);

                days.push(
                    <Box 
                        key={day.toString()}
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
                            color: isSelected 
                                ? '#fff' // Contrast text should be white usually for dark accents. If yellow, maybe black? But white is safer for general accents here.
                                : !isCurrentMonth 
                                    ? 'text.disabled' 
                                    : isDayToday 
                                        ? mainColor 
                                        : 'text.primary',
                            fontWeight: isSelected || isDayToday ? 'bold' : 'normal',
                            border: isDayToday && !isSelected ? `1px solid ${mainColor}` : 'none',
                            '&:hover': {
                                bgcolor: isSelected ? mainColor : 'action.hover', // No dark variant accessible easily if custom hex. Just keep mainColor or use opacity
                                opacity: isSelected ? 0.9 : 1
                            }
                        }}
                    >
                        {formattedDate}
                    </Box>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <Box key={day.toString()} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5 }}>
                    {days}
                </Box>
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
                    m: 'auto' 
                } 
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
