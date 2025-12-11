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
import { Close as CloseIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material'; // ensure imports
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';

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
    
    // const [outputFormat, setOutputFormat] = useState("M月d日(E) H:mm 〜 H:mm"); // Removed per user request

    const [loading, setLoading] = useState(false);

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
                    // Restore Custom Format Logic
                    // User Default: M月d日(E) H:mm 〜 H:mm
                    // Logic: Format Start Date with provided format.
                    // Detection of "End Time" slot: 
                    // We assume the user wants [Date Part] [Start Time] [End Time].
                    // If the user uses the default style, it produces: "3月4日(土) 4:04 〜 4:04"
                    // We replace the LAST occurrence of the time string.
                    
                    // Determine time token roughly by what is in the string? 
                    // Or just use 'H:mm' as default time token to search/replace if not specified?
                    // The example "4:04" implies H:mm (single digit hour). "23:29" implies H:mm.
                    
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
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                空き時間の抽出
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3} sx={{ py: 1 }}>
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>期間</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                size="small" 
                                fullWidth
                            />
                            <Typography>〜</Typography>
                            <TextField 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                size="small" 
                                fullWidth
                            />
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>時間帯</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField 
                                type="time" 
                                value={startTime} 
                                onChange={(e) => setStartTime(e.target.value)} 
                                size="small" 
                                fullWidth
                            />
                            <Typography>〜</Typography>
                            <TextField 
                                type="time" 
                                value={endTime} 
                                onChange={(e) => setEndTime(e.target.value)} 
                                size="small" 
                                fullWidth
                            />
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>曜日</Typography>
                        <ToggleButtonGroup
                            value={selectedDays}
                            onChange={(e, newDays) => setSelectedDays(newDays)}
                            aria-label="days of week"
                            size="small"
                            fullWidth
                            color="primary"
                        >
                            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                                <ToggleButton key={index} value={index} suppressHydrationWarning>
                                    {day}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>

                    <Stack direction="row" spacing={2}>
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
            <DialogActions>
                <Button onClick={handleCopy} variant="contained" disabled={loading} startIcon={<CopyIcon />}>
                    {loading ? "収集中..." : "抽出してコピー"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
