'use client';

import { useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    TextField, Box, Typography, 
    Stack, IconButton, InputAdornment
} from '@mui/material';
import { 
    addDays, format, startOfDay, endOfDay, addMinutes, 
    setHours, setMinutes, differenceInMinutes
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatLocalIsoString } from '@/lib/utils';
import { Close as CloseIcon, ContentCopy as CopyIcon, CalendarMonth as CalendarMonthIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import CustomDatePicker from './ui/CustomDatePicker';
import CustomTimePicker from './ui/CustomTimePicker';
import { useToast } from '@/app/context/ToastContext';
import { CalendarEvent } from '@/types/calendar';
import { AppTask } from '@/types/task';

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
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [resultText, setResultText] = useState("");
    const [extracted, setExtracted] = useState(false);

    // Debug State
    type DebugEvent = {
        title: string;
        start: Date;
        end: Date;
        source: 'Google' | 'Alarm' | 'Task';
    };
    const [debugInfo, setDebugInfo] = useState<DebugEvent[]>([]);
    const [showDebug, setShowDebug] = useState(false);

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

    const handleExtract = async () => {
        setLoading(true);
        setExtracted(false);
        setResultText("");
        setDebugInfo([]); // Reset debug info
        
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const rangeStart = startOfDay(start);
            const rangeEnd = endOfDay(end);

            const [googleRes, alarms, tasksRes] = await Promise.all([
                fetchGoogleEvents(rangeStart, rangeEnd),
                getAlarms(rangeStart, rangeEnd),
                fetch(`/api/tasks?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`).then(r => r.json())
            ]);

            const busySlots: { start: Date, end: Date }[] = [];
            const debugEvents: DebugEvent[] = [];
            const toDate = (d: string | Date) => new Date(d);

            const googleEvents = googleRes?.events || [];
            if (Array.isArray(googleEvents)) {
                (googleEvents as CalendarEvent[]).forEach((e) => {
                    if (e.startTime && e.endTime) {
                        const s = toDate(e.startTime);
                        const ed = toDate(e.endTime);
                        busySlots.push({ start: s, end: ed });
                        debugEvents.push({ title: e.title, start: s, end: ed, source: 'Google' });
                    }
                });
            }

            if (Array.isArray(alarms)) {
                (alarms as CalendarEvent[]).forEach((a) => {
                    if (a.startTime) {
                        const s = toDate(a.startTime);
                        // Alarms are point-in-time, treat as 0 duration for slot but maybe relevant for debug
                        busySlots.push({ start: s, end: s });
                        debugEvents.push({ title: a.title, start: s, end: s, source: 'Alarm' });
                    }
                });
            }

            if (Array.isArray(tasksRes)) {
                (tasksRes as AppTask[]).forEach((t) => {
                    if (t.startDate && t.deadline) {
                         const s = toDate(t.startDate);
                         const ed = toDate(t.deadline);
                         busySlots.push({ start: s, end: ed });
                         debugEvents.push({ title: t.title, start: s, end: ed, source: 'Task' });
                    }
                });
            }
            
            // Sort debug events
            debugEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
            setDebugInfo(debugEvents);

            let result = "";
            let currentDay = new Date(rangeStart);

            while (currentDay <= rangeEnd) {
                const dayNum = currentDay.getDay();
                if (!selectedDays.includes(dayNum)) {
                    currentDay = addDays(currentDay, 1);
                    continue;
                }

                const [sH, sM] = startTime.split(':').map(Number);
                const [eH, eM] = endTime.split(':').map(Number);
                
                let windowStart = setMinutes(setHours(currentDay, sH), sM);
                let windowEnd = setMinutes(setHours(currentDay, eH), eM);

                const effectiveBusy = busySlots.map(slot => ({
                    start: addMinutes(slot.start, -margin),
                    end: addMinutes(slot.end, margin)
                })).filter(slot => {
                    return slot.end > windowStart && slot.start < windowEnd;
                }).sort((a, b) => a.start.getTime() - b.start.getTime());

                const mergedBusy: { start: Date, end: Date }[] = [];
                if (effectiveBusy.length > 0) {
                    let curr = effectiveBusy[0];
                    for (let i = 1; i < effectiveBusy.length; i++) {
                        const next = effectiveBusy[i];
                        if (next.start < curr.end) {
                            curr.end = new Date(Math.max(curr.end.getTime(), next.end.getTime()));
                        } else {
                            mergedBusy.push(curr);
                            curr = next;
                        }
                    }
                    mergedBusy.push(curr);
                }

                let pointer = windowStart;
                const freeSlots: { start: Date, end: Date }[] = [];

                for (const busy of mergedBusy) {
                    if (pointer < busy.start) {
                        if (differenceInMinutes(busy.start, pointer) >= minDuration) {
                            freeSlots.push({ start: pointer, end: busy.start });
                        }
                    }
                    if (pointer < busy.end) {
                        pointer = busy.end;
                    }
                }
                
                if (pointer < windowEnd) {
                    if (differenceInMinutes(windowEnd, pointer) >= minDuration) {
                        freeSlots.push({ start: pointer, end: windowEnd });
                    }
                }

                freeSlots.forEach(slot => {
                    const dateStr = format(slot.start, 'M/d(E)', { locale: ja });
                    const startStr = format(slot.start, 'HH:mm');
                    const endStr = format(slot.end, 'HH:mm');
                    result += `${dateStr} ${startStr} 〜 ${endStr}\n`;
                });

                currentDay = addDays(currentDay, 1);
            }
            
            setResultText(result);
            setExtracted(true);
            showToast('抽出が完了しました', 'success');

        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : String(err);
            showToast(`抽出に失敗しました: ${message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(resultText);
            showToast('クリップボードにコピーしました', 'success');
            onClose();
        } catch (err) {
            console.error(err);
            showToast('コピーに失敗しました', 'error');
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

                    {extracted && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary">抽出結果プレビュー</Typography>
                            <Box sx={{ 
                                p: 1.5, 
                                bgcolor: 'action.hover', 
                                borderRadius: 1, 
                                border: '1px solid',
                                borderColor: 'divider',
                                maxHeight: 200,
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem'
                            }}>
                                {resultText || "空き時間はありませんでした。"}
                            </Box>
                             <Box sx={{ mt: 2 }}>
                                <Button 
                                    size="small" 
                                    onClick={() => setShowDebug(!showDebug)} 
                                    sx={{ mb: 1, textTransform: 'none' }}
                                    color="secondary"
                                >
                                    {showDebug ? "考慮された予定を隠す" : "考慮された予定を表示 (デバッグ)"}
                                </Button>
                                {showDebug && (
                                    <Box sx={{ 
                                        maxHeight: 200, 
                                        overflowY: 'auto', 
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        bgcolor: 'background.paper'
                                    }}>
                                        {debugInfo.length === 0 ? (
                                            <Typography variant="caption" color="text.secondary">予定はありませんでした</Typography>
                                        ) : (
                                            debugInfo.map((e, i) => (
                                                <Box key={i} sx={{ mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" display="block" sx={{ fontWeight: 'bold' }}>
                                                        [{e.source}] {e.title}
                                                    </Typography>
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        {format(e.start, 'M/d HH:mm')} - {format(e.end, 'M/d HH:mm')}
                                                    </Typography>
                                                </Box>
                                            ))
                                        )}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    )}
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
                {extracted ? (
                    <>
                        <Button onClick={() => {
                            setExtracted(false);
                            setResultText("");
                            setShowDebug(false);
                        }} color="inherit">
                            やり直す
                        </Button>
                        <Button onClick={handleCopyToClipboard} variant="contained" color="primary" startIcon={<CopyIcon />} disabled={!resultText}>
                            クリップボードにコピー
                        </Button>
                    </>
                ) : (
                    <Button onClick={handleExtract} variant="contained" disabled={loading} startIcon={<CalendarMonthIcon />}>
                        {loading ? "収集中..." : "空き時間を抽出"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
