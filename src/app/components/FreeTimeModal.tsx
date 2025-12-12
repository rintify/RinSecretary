'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    TextField, Checkbox, FormControlLabel, Box, Typography, 
    Stack, IconButton, InputAdornment, Grid
} from '@mui/material';
import { 
    addDays, format, startOfDay, endOfDay, addMinutes, 
    isWeekend, parse, isBefore, isAfter, setHours, setMinutes,
    differenceInMinutes
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatLocalIsoString } from '@/lib/utils';
import { Close as CloseIcon, ContentCopy as CopyIcon, CalendarMonth as CalendarMonthIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material'; // ensure imports
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import CustomDatePicker from './ui/CustomDatePicker';
import CustomTimePicker from './ui/CustomTimePicker';

interface FreeTimeModalProps {
    onClose: () => void;
}

export default function FreeTimeModal({ onClose }: FreeTimeModalProps) {
    const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
    
    // Time Strings "HH:mm"
    const [startTime, setStartTime] = useState("10:00");
    const [endTime, setEndTime] = useState("17:00");
    
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
    const [margin, setMargin] = useState(30); // minutes
    const [minDuration, setMinDuration] = useState(60); // minutes
    
    // Picker State
    const [pickerConfig, setPickerConfig] = useState<{ type: 'date' | 'time', target: 'start' | 'end' | 'startTime' | 'endTime' } | null>(null);

    const [loading, setLoading] = useState(false);

    // Helpers
    const getDisplayDate = (isoString: string) => {
        if (!isoString) return new Date();
        return new Date(isoString);
    };

    const getDisplayTimeStr = (timeStr: string) => {
        return timeStr;
    };

    // Update Handlers
    const handleDateSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        
        const newStr = formatLocalIsoString(newDate).split('T')[0];

        if (target === 'start') setStartDate(newStr);
        else if (target === 'end') setEndDate(newStr);

        setPickerConfig(null);
    };

    const handleTimeSelect = (newDate: Date) => {
        if (!pickerConfig) return;
        const target = pickerConfig.target;
        
        const formatLocalTime = (date: Date) => {
             const pad = (n: number) => n < 10 ? '0'+n : n;
             return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        const newStr = formatLocalTime(newDate);
        
        if (target === 'startTime') setStartTime(newStr);
        else if (target === 'endTime') setEndTime(newStr);

        setPickerConfig(null); 
    };

    const handleCopy = async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const rangeStart = startOfDay(start);
            const rangeEnd = endOfDay(end);

            // Fetch DB Tasks for potential future check (Currently UI only fetches Google Events/Alarms for this logic as per request context implication, but usually specific "Scheduled" items)
            // The prompt says "候補の時間枠からイベント+マージンを引いた中から". This implies Google Events + Alarms + Maybe DB Tasks if they have fixed time.
            // Let's grab Tasks from API as well to be safe, filtering for those with startTime/endTime.
            
            const [googleEvents, alarms, tasksRes] = await Promise.all([
                fetchGoogleEvents(rangeStart, rangeEnd),
                getAlarms(rangeStart, rangeEnd),
                fetch(`/api/tasks?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`).then(r => r.json())
            ]);

            // Combine all busy slots
            // We only care about items that have specific time ranges.
            const busySlots: { start: Date, end: Date }[] = [];

            // Helper to parse dates
            const toDate = (d: any) => new Date(d);

            // Google Events
            if (Array.isArray(googleEvents)) {
                googleEvents.forEach((e: any) => {
                    if (e.startTime && e.endTime) {
                        busySlots.push({ start: toDate(e.startTime), end: toDate(e.endTime) });
                    }
                });
            }

            // Alarms (Point in time, but maybe treat as a small block? Prompt says "Event + Margin". User didn't specify Alarm duration. Let's assume Alarms take 0 time but margin will apply around it.)
            if (Array.isArray(alarms)) {
                alarms.forEach((a: any) => {
                    if (a.time) {
                        // Treat as 0-minute event
                        busySlots.push({ start: toDate(a.time), end: toDate(a.time) });
                    }
                });
            }

            // DB Tasks (if they have start/end time, they are events effectively)
            if (Array.isArray(tasksRes)) {
                tasksRes.forEach((t: any) => {
                    if (t.startTime && t.endTime) {
                         busySlots.push({ start: toDate(t.startTime), end: toDate(t.endTime) });
                    }
                });
            }

            // Generate candidates
            let resultText = "";
            let currentDay = new Date(rangeStart);

            while (currentDay <= rangeEnd) {
                // Check day filter
                // date-fns getDay: 0=Sun, 1=Mon...
                const dayNum = currentDay.getDay();
                if (!selectedDays.includes(dayNum)) {
                    currentDay = addDays(currentDay, 1);
                    continue;
                }

                // Define Search Window for the day
                const [sH, sM] = startTime.split(':').map(Number);
                const [eH, eM] = endTime.split(':').map(Number);
                
                let windowStart = setMinutes(setHours(currentDay, sH), sM);
                let windowEnd = setMinutes(setHours(currentDay, eH), eM);

                // If window crosses midnight, end is next day (Simple case: assume same day for typical 10-17)
                // If ending time < starting time, assume next day? Not typical for "Free Time" which usually implies daily working hours.
                // We'll assume strict daily window.

                // Calculate available chunks within [windowStart, windowEnd]
                // Subtract busy slots + margins.
                
                // Effective Busy Slots for this day
                // Apply margin to busy slots: [start - margin, end + margin]
                const effectiveBusy = busySlots.map(slot => ({
                    start: addMinutes(slot.start, -margin),
                    end: addMinutes(slot.end, margin)
                })).filter(slot => {
                    // Overlap check
                    return slot.end > windowStart && slot.start < windowEnd;
                }).sort((a, b) => a.start.getTime() - b.start.getTime());

                // Merge overlapping busy slots
                const mergedBusy: { start: Date, end: Date }[] = [];
                if (effectiveBusy.length > 0) {
                    let curr = effectiveBusy[0];
                    for (let i = 1; i < effectiveBusy.length; i++) {
                        const next = effectiveBusy[i];
                        if (next.start < curr.end) {
                            // Overlap or adjacent
                            curr.end = new Date(Math.max(curr.end.getTime(), next.end.getTime()));
                        } else {
                            mergedBusy.push(curr);
                            curr = next;
                        }
                    }
                    mergedBusy.push(curr);
                }

                // Find gaps
                let pointer = windowStart;
                const freeSlots: { start: Date, end: Date }[] = [];

                for (const busy of mergedBusy) {
                    if (pointer < busy.start) {
                        // Found a gap
                        if (differenceInMinutes(busy.start, pointer) >= minDuration) {
                            freeSlots.push({ start: pointer, end: busy.start });
                        }
                    }
                    if (pointer < busy.end) {
                        pointer = busy.end;
                    }
                }
                
                // Check final gap after last busy slot
                if (pointer < windowEnd) {
                    if (differenceInMinutes(windowEnd, pointer) >= minDuration) {
                        freeSlots.push({ start: pointer, end: windowEnd });
                    }
                }

                freeSlots.forEach(slot => {
                    // Simplified Standard Format: M/d(E) HH:mm 〜 HH:mm
                    const dateStr = format(slot.start, 'M/d(E)', { locale: ja });
                    const startStr = format(slot.start, 'HH:mm');
                    const endStr = format(slot.end, 'HH:mm');
                    
                    resultText += `${dateStr} ${startStr} 〜 ${endStr}\n`;
                });

                currentDay = addDays(currentDay, 1);
            }
            
            await navigator.clipboard.writeText(resultText);
            // alert("Copied!"); // Simple feedback or close?
            onClose();

        } catch (e) {
            console.error(e);
            alert("Error calculating free time");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { m: 2, width: '92%', maxWidth: 'sm', borderRadius: 2 } }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                空き時間の抽出
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2 }}>
                <Stack spacing={2} sx={{ py: 0 }}>
                    <Box>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">期間</Typography>
                        <Stack spacing={1}>
                            {/* Start Date */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">開始</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'bold' }}>
                                        {format(getDisplayDate(startDate), 'yyyy/MM/dd (E)', { locale: ja })}
                                    </Typography>
                                    <IconButton 
                                        onClick={() => setPickerConfig({ type: 'date', target: 'start' })}
                                        size="small"
                                        sx={{ color: 'primary.main' }}
                                    >
                                        <CalendarMonthIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                            
                            {/* End Date */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">終了</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'bold' }}>
                                        {format(getDisplayDate(endDate), 'yyyy/MM/dd (E)', { locale: ja })}
                                    </Typography>
                                    <IconButton 
                                        onClick={() => setPickerConfig({ type: 'date', target: 'end' })}
                                        size="small"
                                        sx={{ color: 'primary.main' }}
                                    >
                                        <CalendarMonthIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom color="text.secondary">時間帯</Typography>
                        <Stack spacing={1}>
                            {/* Start Time */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">開始</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'bold' }}>
                                        {getDisplayTimeStr(startTime)}
                                    </Typography>
                                    <IconButton 
                                        onClick={() => setPickerConfig({ type: 'time', target: 'startTime' })}
                                        size="small"
                                        sx={{ color: 'primary.main' }}
                                    >
                                        <AccessTimeIcon />
                                    </IconButton>
                                </Box>
                            </Box>

                            {/* End Time */}
                            <Box>
                                <Typography variant="caption" color="text.secondary">終了</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body1" sx={{ mr: 1, fontWeight: 'bold' }}>
                                        {getDisplayTimeStr(endTime)}
                                    </Typography>
                                    <IconButton 
                                        onClick={() => setPickerConfig({ type: 'time', target: 'endTime' })}
                                        size="small"
                                        sx={{ color: 'primary.main' }}
                                    >
                                        <AccessTimeIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>曜日</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                           <ToggleButtonGroup
                               value={selectedDays}
                               onChange={(e, newDays) => setSelectedDays(newDays)}
                               aria-label="days of week"
                               size="small"
                               fullWidth
                               color="primary"
                           >
                               {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                                   <ToggleButton key={index} value={index} suppressHydrationWarning sx={{ px: 1 }}>
                                       {day}
                                   </ToggleButton>
                               ))}
                           </ToggleButtonGroup>
                        </Box>
                    </Box>

                    <Stack spacing={2} direction="row">
                        <Box sx={{ flex: 1 }}>
                            <TextField 
                                label="マージン (分)"
                                type="number" 
                                value={margin} 
                                onChange={(e) => setMargin(Number(e.target.value))} 
                                size="small" 
                                fullWidth
                                InputProps={{ endAdornment: <InputAdornment position="end">分</InputAdornment> }}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <TextField 
                                label="最低時間"
                                type="number" 
                                value={minDuration} 
                                onChange={(e) => setMinDuration(Number(e.target.value))} 
                                size="small" 
                                fullWidth
                                InputProps={{ endAdornment: <InputAdornment position="end">分</InputAdornment> }}
                            />
                        </Box>
                    </Stack>

                </Stack>
            </DialogContent>
            
            <CustomDatePicker
                open={pickerConfig?.type === 'date'}
                onClose={() => setPickerConfig(null)}
                value={getDisplayDate(pickerConfig?.target === 'start' ? startDate : endDate)}
                onChange={handleDateSelect}
            />
            
            <CustomTimePicker
                open={pickerConfig?.type === 'time'}
                onClose={() => setPickerConfig(null)}
                value={(() => {
                    const t = pickerConfig?.target === 'startTime' ? startTime : endTime;
                    const d = new Date();
                    const [h, m] = t.split(':').map(Number);
                    d.setHours(h, m);
                    return d;
                })()}
                onChange={handleTimeSelect}
                showDate={false}
            />

            <DialogActions>
                <Button onClick={handleCopy} variant="contained" disabled={loading} startIcon={<CopyIcon />}>
                    {loading ? "収集中..." : "抽出してコピー"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
