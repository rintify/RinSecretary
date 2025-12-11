
'use client';

import { useState, useRef, useCallback } from 'react';
import { Fab, FabProps } from '@mui/material';

interface LongPressFabProps extends FabProps {
    onLongPress?: () => void;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export default function LongPressFab({ onLongPress, onClick, children, ...props }: LongPressFabProps) {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPress = useRef(false);

    const startPress = useCallback(() => {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
            isLongPress.current = true;
            if (onLongPress) {
                onLongPress();
                // Optional: Vibrate if on mobile
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }, 500); // 500ms for long press
    }, [onLongPress]);

    const endPress = useCallback((e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        
        if (!isLongPress.current && onClick) {
            // It was a short press
            // We need to cast event because onClick expects MouseEvent
            onClick(e as React.MouseEvent<HTMLButtonElement>); 
        }
    }, [onClick]);

    return (
        <Fab
            {...props}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
            }}
            onTouchStart={startPress}
            onTouchEnd={endPress}
        >
            {children}
        </Fab>
    );
}
