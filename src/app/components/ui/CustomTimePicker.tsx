'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogContent, 
    Typography, 
    Box, 
    Slider,
    Button,
    Stack,
    IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CustomTimePickerProps {
    open: boolean;
    onClose: () => void;
    value: Date; // The full date object
    onChange: (date: Date) => void;
}

// Helper to get total minutes from 00:00 of the DATE part of 'value'
// BUT we need to handle the 4:00 - 28:00 logic.
// 28:00 is 1 day + 4 hours.
// If the user passes a date that is "Today 23:00", min is 23*60 = 1380. 
// If the user passes "Tomorrow 01:00", is that 25:00 of Today? Or 1:00 of Tomorrow (calendar day)?
// The UI needs to be consistent. 
// Assumption: The "Base Date" is the one selected in the Date Picker. 
// The Time Picker adds an offset to that Base Date.
// If the Time Picker selects 25:00, it effectively sets the date to Base Date + 1 day, 01:00.
// So we need to know the "Base Date" (start of day).
// Since 'value' contains both, we can try to deduce standard time. 
// But the UI needs to show "25:00" for 1AM tomorrow.
// So we really need to know "What is the day we are counting from?"

// To simplify: We probably need to treat `value` as the source of truth.
// If `value` hour is < 4, we assume it belongs to the "Previous Day's 24h+" cycle?
// Or we just display standard time and let the slider handle the visual "28:00"?
// User asked to *Select* 4:00-28:00.
// If I input 2023-10-10 01:00:
// Is that 2023-10-09 25:00? Or 2023-10-10 01:00 (which is out of range 4:00-28:00 if 2023-10-10 is the base)?
// Actually 4:00 - 28:00 covers a full 24h cycle (4am to next 4am). 
// So any time can be represented.
// 01:00 would be represented as 25:00 (of previous day?).
// Let's assume the "Date" picker sets the Base Day.
// And this Time Picker sets the offset from that Base Day's 00:00.
// So if Date Picker says "Oct 10", and Time Picker says "26:00" (Oct 11 02:00), 
// then the underlying value becomes Oct 11 02:00.
// When we OPEN the Time Picker with Oct 11 02:00, AND the Date Picker (conceptually) is showing "Oct 10",
// then we show 26:00.
// BUT, we only have `value` here. We don't know what the Date Picker is showing unless we pass `baseDate`.
// Let's assume `value` is enough. 
// We will simply display the time relative to the `value`'s own "start of day" UNLESS the hour is < 4.
// If hour < 4 (e.g. 01:00, 02:00, 03:00), we treat it as 25, 26, 27 of the PREVIOUS day?
// NO, that might be confusing if the user explicitly picked "Oct 11" in the Date Picker.
// If the Date Picker says "Oct 11", and I open Time Picker, and it shows "Start of Day + offset".
// 4:00 = 240 min. 28:00 = 1680 min.
// If existing time is 10:00 (600 min), slider is at 600.
// If existing time is 01:00 (60 min), this is OUTSIDE 4:00(240)-28:00(1680) range relative to *that day*.
// UNLESS we treat 01:00 as 25:00 of the *previous* day? But then the date would be wrong.
// Wait, 4:00 to 28:00 is a 24h period shifted by 4 hours.
// So effectively, a "Day" starts at 4:00 AM and ends at 4:00 AM next day.
// If the current time is 03:00, it belongs to the "Previous Day" logically in this system.
// For now, let's just stick to a simple logic:
// We calculate minutes from 00:00 of the `value`'s date.
// If minutes < 240 (4:00), we add 1440 (24h) to show it as 24+?
// No, that would imply it's "Tomorrow".
// Let's just implement the slider 4:00 - 28:00.
// If the passed `value` is 02:00, how do we show it?
// Maybe we default to 4:00 if it's out of range? Or show it as 26:00 (implying it was set as late night)?
// Let's assume standard behavior:
// Calculate min from 00:00.
// If < 240 (4am), we visualize it as 24 + hour. (e.g. 1am -> 25:00).
// If >= 240, we visualize normally. (e.g. 10am -> 10:00).
// BUT if we treat 1am as 25:00, we are effectively saying "1am is 25:00 of THIS day".
// Which technically means 1am of TOMORROW. 
// This is getting complicated.
// "Date Picker" -> Sets "Year-Month-Day". 
// "Time Picker" -> Sets "Time" relative to that Day.
// 4:00 - 28:00 means we can select from "Day 04:00" to "Day+1 04:00".
// So if I picked "Oct 10" in Date Picker.
// I can select "Oct 10 04:00" up to "Oct 11 04:00".
// If I pass "Oct 11 01:00" to this picker, it should show as "25:00" (implied relative to Oct 10).
// BUT the component only gets `value`. It doesn't know "Oct 10" was the intended base.
// It sees "Oct 11". 
// If it sees "Oct 11 01:00", relative to "Oct 11" it is 60 min. (Too small for 240 min min).
// Relative to "Oct 10", it is 25*60 + ...
// The prompt says "Time and Minute setting UI".
// Let's rely on the user interface flow: The user picks a Date, then picks a Time.
// When they pick a Time, we update the `value`.
// Inside `CustomTimePicker`, let's just default to "Start of `value`'s Day" as base.
// UNLESS the hour is < 4. If hour < 4, we assume it's "Late Night" of the previous day?
// Actually if I am editing an event "Oct 11 01:00", and I open the picker.
// If I treat it as "Oct 11" base, 1:00 is less than 4:00. Detailed logic needed.

// Proposal:
// Always assume the "Base" is the date part of `value` (00:00).
// If the time is < 4:00, we treat it as 24h + time? No, because that changes the Date.
// Let's implicitly assume the user manages the "Base Date" via the Date picker.
// When `CustomTimePicker` receives a `value`, it checks:
// Is `value` < 4:00 relative to is own date?
// If YES, maybe we should display it as 24+? and the slider should start at 240? 
// No 4:00 is min.
// If `value` is 2023-10-11 01:00.
// Standard slider 4:00(240) - 28:00(1680).
// 01:00 is 60 min. Range invalid.
// Maybe we shift the view to "Previous Day Base"? => 2023-10-10 25:00?
// YES. If hour < 4, we assume the intended display is "Late Night Previous Day".
// So we calculate minutes relative to `subDays(value, 1)`.
// e.g. Oct 11 01:00. Base = Oct 10. Min = 24*60 + 60 = 1500. (Fits in 240-1680).
// If hour >= 4, we use `value` date as base.
// e.g. Oct 11 05:00. Base = Oct 11. Min = 300. (Fits).

export default function CustomTimePicker({ open, onClose, value, onChange }: CustomTimePickerProps) {
    const [minutes, setMinutes] = useState(0); // 240 to 1680

    useEffect(() => {
        if (open && value) {
            const h = value.getHours();
            const m = value.getMinutes();
            if (h < 4) {
                 // Treat as "next day" time, so add 24h to display
                 setMinutes((h + 24) * 60 + m);
            } else {
                 setMinutes(h * 60 + m);
            }
        }
    }, [open, value]);

    const formatTime = (totalMins: number) => {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        // Allows 24:xx, 25:xx etc.
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const handleChange = (_: Event, newValue: number | number[]) => {
        setMinutes(newValue as number);
    };

    const handleConfirm = () => {
        // Convert back to Date
        // We need to be careful about the Date part.
        // If we "shifted" the base for display (h < 4), we need to respect that on save?
        // Actually, the `value` passed had a specific logic.
        // We want to update the TIME of `value`.
        // BUT `value` also has a Date.
        // If the user selects "25:00" (Min=1500), that means "Base Date + 1 day + 1:00".
        // What is "Base Date"?
        // If we used `h < 4` logic to shift display, it implies the Base Date was `value - 1 day`.
        // If we used normal logic, Base Date was `value`.
        
        // Let's be consistent: The "Base Date" is `value`'s date, UNLESS we detected that `value` was late night.
        // If `value` was Oct 11 01:00, we displayed 25:00 (Base Oct 10).
        // If user changes it to 26:00 (Base Oct 10), result is Oct 11 02:00.
        // If user changes it to 10:00 (Base Oct 10 + 600m), result is Oct 10 10:00.
        // WAIT. If result is Oct 10 10:00, we effectively Changed the DATE from Oct 11 to Oct 10.
        // This implicitly changes the Date. Is this desired?
        // Usually Time Picker shouldn't change the calendar Date (Year/Month/Day) unless it's the rollover.
        // But here the "Date Picker" is separate.
        // If I picked Oct 11 in Date Picker. And I have 01:00. 
        // If I open Time Picker, and it shows 25:00. And I slide to 10:00.
        // It becomes Oct 10 10:00 ?? 
        // That contradicts the Date Picker which says Oct 11.
        
        // CORRECTION:
        // The Date Picker dictates the Base Date.
        // The Time Picker should ALWAYS be relative to that Base Date.
        // BUT `CustomTimePicker` only receives `value` (Date). It doesn't know the "User Intended Base Date".
        // HOWEVER, in the parent provided `onChange`, we can handle merging.
        // BUT the UI inside TimePicker needs to enable the slider.
        // Let's pass `baseDate` prop if possible? Or purely handle it locally?
        // Let's assume `value` *is* the date relative to which we are picking time? 
        // Or simpler:
        // If h < 4, it's 24+h.
        // We assume the user wants 4:00-28:00 relative to the "Morning" of the current date.
        // So validation:
        // If existing is 01:00. We display 25:00.
        // If user picks 26:00 -> 02:00. (Same date? No, Next day).
        // If user picks 10:00 -> 10:00. (Previous day??)
        
        // Let's Refine Component Props:
        // Pass `baseDate`? No, the signature is fixed in my plan but I can change it.
        // Let's stick to `value`.
        // We'll assume the `baseDate` is `startOfDay(value)` if h >= 4.
        // If h < 4, `baseDate` is `startOfDay(subDays(value, 1))`.
        
        // When Saving:
        // We take that `derivedBaseDate` and add the minutes.
        // Example 1: Value = Oct 11 10:00. h=10. Base = Oct 11. Slider=600.
        // User changes to 25:00 (1500). Result = Oct 11 00:00 + 1500m = Oct 12 01:00.
        // (Date changed, which is correct for 25:00).
        
        // Example 2: Value = Oct 12 01:00. h=1. Base = Oct 11. Slider=1500 (25:00).
        // User changes to 10:00 (600). Result = Oct 11 00:00 + 600m = Oct 11 10:00.
        // (Date changed back to Oct 11. Correct).
        
        // This seems consistent!
        
        const h = value.getHours();
        let baseDate = new Date(value);
        baseDate.setHours(0, 0, 0, 0);
        
        if (h < 4) {
            baseDate.setTime(baseDate.getTime() - 24 * 60 * 60 * 1000);
        }
        
        // Add minutes
        const newDate = new Date(baseDate.getTime() + minutes * 60 * 1000);
        onChange(newDate);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent sx={{ pt: 1, pb: 4, px: 3, textAlign: 'center' }}>
                <Typography variant="h3" fontWeight="bold" color="primary" sx={{ mb: 4 }}>
                    {formatTime(minutes)}
                </Typography>
                
                <Box sx={{ px: 2 }}>
                    <Slider
                        value={minutes}
                        onChange={handleChange}
                        min={240} // 4:00
                        max={1680} // 28:00
                        step={5} // 5 min
                        valueLabelDisplay="auto"
                        valueLabelFormat={formatTime}
                        marks={[
                            { value: 240, label: '4:00' },
                            { value: 720, label: '12:00' },
                            { value: 1200, label: '20:00' },
                            { value: 1680, label: '28:00' },
                        ]}
                    />
                </Box>
                
                <Button 
                    variant="contained" 
                    fullWidth 
                    size="large" 
                    onClick={handleConfirm}
                    sx={{ mt: 4, borderRadius: 2, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
                >
                    OK
                </Button>
            </DialogContent>
        </Dialog>
    );
}
