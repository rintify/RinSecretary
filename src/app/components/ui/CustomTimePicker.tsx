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
import { GuideBubble } from './GuideBubble';

interface CustomTimePickerProps {
    open: boolean;
    onClose: () => void;
    value: Date;
    onChange: (date: Date) => void;
    showDate?: boolean;
    guideMessage?: string;
    accentColor?: string;
}

export default function CustomTimePicker({ open, onClose, value, onChange, showDate = true, guideMessage, accentColor }: CustomTimePickerProps) {
    const [currentDate, setCurrentDate] = useState(value);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastAngle = useRef<number | null>(null);
    const theme = useTheme();

    const mainColor = accentColor || theme.palette.primary.main;

    const [isOutside, setIsOutside] = useState(false); // State to track lock mode
    const isOutsideRef = useRef(false); // Ref for synchronous logic

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
            setIsOutside(false);
            isOutsideRef.current = false;
        }
    }, [open, value]);

    // Calculate angle from center to point (0 degrees at top, clockwise)
    const getAngleAndDistance = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { angle: 0, distance: 0 };
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

        const distance = Math.sqrt(x * x + y * y);

        return { angle: angleDeg, distance };
    };

    const accumulatedRotationRef = useRef(0);

    const handleUpdate = useCallback((clientX: number, clientY: number, isFinal: boolean) => {
        const { angle, distance } = getAngleAndDistance(clientX, clientY);
        
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const radius = rect.width / 2;
            
            if (distance > radius * 1.05 && !isFinal) {
                if (!isOutsideRef.current) {
                    setIsOutside(true);
                    isOutsideRef.current = true;
                    // Reset accumulation when entering fixed mode
                    accumulatedRotationRef.current = 0;
                }
            } else {
                if (isOutsideRef.current) {
                    setIsOutside(false);
                    isOutsideRef.current = false;
                    // Reset accumulation when exiting fixed mode
                    accumulatedRotationRef.current = 0;
                }
            }
        }

        const currentAngle = angle;
        
        let dayChange = 0;
        let angleDelta = 0;

        if (lastAngle.current !== null) {
            const rawDelta = currentAngle - lastAngle.current;
            
            // Day change detection for Absolute Mode
            if (rawDelta < -180) {
                dayChange = 1;
            } else if (rawDelta > 180) {
                dayChange = -1;
            }

            // Normalization for Relative Mode calculation (shortest path)
            angleDelta = rawDelta;
            if (angleDelta < -180) angleDelta += 360;
            if (angleDelta > 180) angleDelta -= 360;
        }
        
        lastAngle.current = currentAngle;

        // --- FIXED MODE (Relative Rotation) ---
        if (isOutsideRef.current && !isFinal) {
            accumulatedRotationRef.current += angleDelta;

            const THRESHOLD = 20; // 20 degrees
            const MINUTES_PER_STEP = 5;

            const steps = Math.trunc(accumulatedRotationRef.current / THRESHOLD);

            if (steps !== 0) {
                accumulatedRotationRef.current -= steps * THRESHOLD;
                const minutesToAdd = steps * MINUTES_PER_STEP;

                setCurrentDate(prev => {
                    const newDate = new Date(prev.getTime() + minutesToAdd * 60000);
                    
                    if (isFinal) {
                        setTimeout(() => {
                            onChange(newDate);
                            onClose();
                        }, 0);
                    }
                    return newDate;
                });
            }
            return;
        }

        // --- NORMAL MODE (Absolute Position) ---
        const totalMinutes = Math.round((currentAngle / 360) * 1440 / 5) * 5;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;

        setCurrentDate(prev => {
            let newDate = new Date(prev);
            
            // Apply day change only if we have a valid previous angle tracking
            // (If lastAngle was null, dayChange is 0, which is correct for initial touch)
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
        // Initialize angle
         const { angle } = getAngleAndDistance(e.clientX, e.clientY);
        lastAngle.current = angle;
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
        
        // If we were locked (outside), confirm the current stable value instead of updating to the pointer position
        if (isOutsideRef.current) {
            setIsOutside(false);
            isOutsideRef.current = false;
            
            setTimeout(() => {
                onChange(currentDate);
                onClose();
            }, 0);
        } else {
            // Normal release - update to final position and confirm
            setIsOutside(false);
            isOutsideRef.current = false;
            handleUpdate(e.clientX, e.clientY, true);
        }
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
                    backgroundImage: 'none',
                    overflow: 'visible'
                } 
            }}
        >
             {guideMessage && <GuideBubble message={guideMessage} />}
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
                            stroke={isOutside ? mainColor : theme.palette.action.selected} 
                            strokeWidth="24" 
                            style={{ transition: 'stroke 0.3s ease' }}
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
                            fill={mainColor} 
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
                        <Typography variant="h3" fontWeight="bold" sx={{ color: mainColor }}>
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
                    accentColor={accentColor}
                />
            </DialogContent>
        </Dialog>
    );
}
