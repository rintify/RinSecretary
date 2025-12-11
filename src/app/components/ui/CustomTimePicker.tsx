'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Dialog, 
    DialogContent, 
    Typography, 
    Box, 
    useTheme
} from '@mui/material';
import { format, addDays, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import CustomDatePicker from './CustomDatePicker';

interface CustomTimePickerProps {
    open: boolean;
    onClose: () => void;
    value: Date;
    onChange: (date: Date) => void;
    showDate?: boolean;
}

export default function CustomTimePicker({ open, onClose, value, onChange, showDate = true }: CustomTimePickerProps) {
    const [currentDate, setCurrentDate] = useState(value);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastAngle = useRef<number | null>(null);
    const theme = useTheme();

    // Handle date selection from internal DatePicker
    const handleDateSelect = (newDate: Date) => {
        setCurrentDate(prev => {
            const updated = new Date(newDate);
            updated.setHours(prev.getHours());
            updated.setMinutes(prev.getMinutes());
            return updated;
        });
        setShowDatePicker(false);
    };

    useEffect(() => {
        if (open) {
            setCurrentDate(value);
            lastAngle.current = null;
        }
    }, [open, value]);

    // Calculate angle from center to point (0 degrees at top, clockwise)
    const getAngle = (clientX: number, clientY: number) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const x = clientX - centerX;
        const y = clientY - centerY;
        
        // Atan2 returns angle from X axis (Right). 
        // We want 0 at Top (-Y).
        // Standard atan2: 0 at Right, 90 at Bottom, 180 at Left, -90 at Top.
        // We want: Top(0) -> Right(90) -> Bottom(180) -> Left(270).
        
        // Let's use standard atan2(y, x).
        // -90 (Top) -> offset by +90 -> 0.
        let angleDeg = Math.atan2(y, x) * (180 / Math.PI);
        angleDeg += 90; 
        if (angleDeg < 0) angleDeg += 360;
        return angleDeg;
    };

    const handleUpdate = useCallback((clientX: number, clientY: number, isFinal: boolean) => {
        const angle = getAngle(clientX, clientY);
        const currentAngle = angle;
        
        let dayChange = 0;
        
        // Detect wrap around using Ref synchronously
        if (lastAngle.current !== null) {
            const delta = currentAngle - lastAngle.current;
            if (delta < -180) {
                // Crossover 360 -> 0 (Clockwise) -> Next Day
                dayChange = 1;
            } else if (delta > 180) {
                // Crossover 0 -> 360 (Counter-Clockwise) -> Prev Day
                dayChange = -1;
            }
        }
        
        lastAngle.current = currentAngle;

        const totalMinutes = Math.round((currentAngle / 360) * 1440 / 5) * 5;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;

        // Calculate new date outside (for the purely functional update part, we just use the closure's dayChange)
        // Actually we need 'prev' value to apply dayChange.
        
        // IMPORTANT: We need to set the state.
        
        setCurrentDate(prev => {
            let newDate = new Date(prev);
            if (dayChange !== 0) {
                newDate = dayChange > 0 ? addDays(newDate, dayChange) : subDays(newDate, Math.abs(dayChange));
            }
            newDate.setHours(hours);
            newDate.setMinutes(minutes);
            
            if (isFinal) {
                setTimeout(() => {
                    onChange(newDate);
                    onClose();
                }, 0);
            }
            
            return newDate;
        });
    }, [onChange, onClose]);

    const handlePointerDown = (e: React.PointerEvent) => {
        // Only trigger drag if not clicking center
        // But center is an overlay. We can just prevent propagation on center if needed.
        // Or check target.
        e.preventDefault();
        isDragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
        lastAngle.current = getAngle(e.clientX, e.clientY);
        handleUpdate(e.clientX, e.clientY, false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.preventDefault();
        handleUpdate(e.clientX, e.clientY, false);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        handleUpdate(e.clientX, e.clientY, true);
    };

    // Visualization
    const totalMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const angle = (totalMinutes / 1440) * 360;
    
    // Size Constants
    const SIZE = 280;
    const CENTER = SIZE / 2;
    const RADIUS = CENTER - 20; // Padding

    const rad = (angle - 90) * (Math.PI / 180);
    const knobX = CENTER + RADIUS * Math.cos(rad);
    const knobY = CENTER + RADIUS * Math.sin(rad);

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth={false}
            PaperProps={{ 
                sx: { 
                    width: '95%', 
                    maxWidth: '360px', 
                    borderRadius: 4, 
                    p: 2,
                    m: 'auto',
                    backgroundColor: theme.palette.background.paper,
                    backgroundImage: 'none'
                } 
            }}
        >
            <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                <Box 
                    ref={containerRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    sx={{ 
                        position: 'relative', 
                        width: '100%',
                        maxWidth: '300px',
                        aspectRatio: '1/1',
                        touchAction: 'none',
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                        m: 'auto'
                    }}
                >
                    <svg style={{ width: '100%', height: '100%', display: 'block' }} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                        {/* Background Circle */}
                        <circle 
                            cx={CENTER} 
                            cy={CENTER} 
                            r={RADIUS} 
                            fill="none" 
                            stroke={theme.palette.action.selected} 
                            strokeWidth="24" 
                        />
                        
                        {/* Tick Marks */}
                        {Array.from({ length: 12 }).map((_, i) => {
                            const tickAngle = i * 30;
                            const tickRad = (tickAngle - 90) * (Math.PI / 180);
                            const outR = RADIUS;
                            const inR = RADIUS - 10;
                            const x1 = CENTER + outR * Math.cos(tickRad);
                            const y1 = CENTER + outR * Math.sin(tickRad);
                            const x2 = CENTER + inR * Math.cos(tickRad);
                            const y2 = CENTER + inR * Math.sin(tickRad);
                            return (
                                <line 
                                    key={i} 
                                    x1={x1} y1={y1} x2={x2} y2={y2} 
                                    stroke={theme.palette.text.disabled} 
                                    strokeWidth={i % 3 === 0 ? 3 : 1}
                                />
                            );
                        })}

                        {/* Knob */}
                        <circle 
                            cx={knobX} 
                            cy={knobY} 
                            r="16" 
                            fill={theme.palette.primary.main} 
                            stroke={theme.palette.background.paper}
                            strokeWidth="4"
                            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
                        />
                    </svg>

                    {/* Center Text - Clickable */}
                    <Box 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (showDate) setShowDatePicker(true);
                        }}
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            cursor: showDate ? 'pointer' : 'default',
                            pointerEvents: 'auto',
                            userSelect: 'none',
                            p: 2,
                            borderRadius: '50%',
                            '&:hover': {
                                bgcolor: showDate ? 'action.hover' : 'transparent'
                            }
                        }}
                    >
                        {showDate && (
                            <Typography variant="body1" color="text.secondary" fontWeight="bold">
                                {format(currentDate, 'M/d(E)', { locale: ja })}
                            </Typography>
                        )}
                        <Typography variant="h3" fontWeight="bold" color="primary">
                            {format(currentDate, 'HH:mm')}
                        </Typography>
                    </Box>
                </Box>
                
                <Typography variant="caption" color="text.disabled" sx={{ mt: 3 }}>
                    スライダーを回して時刻を変更
                </Typography>

                {/* Internal DatePicker */}
                <CustomDatePicker
                    open={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    value={currentDate}
                    onChange={handleDateSelect}
                />
            </DialogContent>
        </Dialog>
    );
}
