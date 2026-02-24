
import React, { useState } from 'react';
import { Dialog, DialogContent, Typography, Slider, Button, Box, useTheme } from '@mui/material';
import { GuideBubble } from './GuideBubble';

interface DurationPickerModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (durationMinutes: number) => void;
    initialDuration?: number;
    guideMessage?: string;
    accentColor?: string;
}

export default function DurationPickerModal({ open, onClose, onConfirm, initialDuration = 60, guideMessage, accentColor }: DurationPickerModalProps) {
    const [duration, setDuration] = useState(initialDuration);
    const theme = useTheme();
    const mainColor = accentColor || theme.palette.primary.main;

    const handleChange = (event: Event, newValue: number | number[]) => {
        setDuration(newValue as number);
    };

    const handleChangeCommitted = (event: React.SyntheticEvent | Event, newValue: number | number[]) => {
        // Add a small delay to show the final value before closing
        setTimeout(() => {
            onConfirm(newValue as number);
        }, 300);
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth={false}
            PaperProps={{ 
                sx: {
                    width: '92%',
                    maxWidth: '600px',
                    m: 'auto',
                    borderRadius: 3, 
                    p: 4, 
                    overflow: 'visible'
                }
            }}
        >
            {guideMessage && <GuideBubble message={guideMessage} />}
            <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Typography variant="h6" color="text.secondary">イベント時間</Typography>
                
                <Typography variant="h2" fontWeight="bold" sx={{ color: mainColor }}>
                    {Math.floor(duration / 60) > 0 ? 
                        <>{Math.floor(duration / 60)}<Typography component="span" variant="h4" color="text.secondary" sx={{ mr: 2 }}>時間</Typography></> 
                        : ''}
                    {duration % 60}<Typography component="span" variant="h4" color="text.secondary">分</Typography>
                </Typography>

                <Box sx={{ width: '100%', px: 1, py: 2 }}>
                    <Slider
                        value={duration}
                        min={5}
                        max={780}
                        step={5}
                        onChange={handleChange}
                        onChangeCommitted={handleChangeCommitted}
                        valueLabelDisplay="auto"
                        sx={{
                            color: mainColor,
                            height: 12, // Thicker track
                            '& .MuiSlider-thumb': {
                                width: 32,
                                height: 32,
                                backgroundColor: '#fff',
                                border: '4px solid currentColor',
                                '&:hover, &.Mui-focusVisible': {
                                    boxShadow: `0 0 0 8px ${accentColor ? accentColor + '30' : 'rgba(0,0,0,0.1)'}`
                                }
                            },
                        }}
                    />
                </Box>
                
                <Box sx={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 40 }}>
                    <Typography variant="caption" color="text.disabled">
                        スライダーを離すと決定します
                    </Typography>
                    <Button 
                        variant="text" 
                        onClick={() => onConfirm(duration)} 
                        size="small"
                        sx={{
                            color: mainColor,
                            minWidth: 60,
                            fontWeight: 'bold',
                            position: 'absolute',
                            right: 0,
                            '&:hover': {
                                bgcolor: accentColor ? accentColor + '10' : 'rgba(0,0,0,0.05)',
                            }
                        }}
                    >
                        OK
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
