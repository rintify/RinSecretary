'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, animate, PanInfo } from 'framer-motion';
import { addDays, subDays } from 'date-fns';
import { Box } from '@mui/material';
import TimeTable from './TimeTable';
import { TaskLocal } from './TimeTable';

interface TimeTableCarouselProps {
    currentDate: Date;
    onDateChange: (newDate: Date) => void;
    onNewTask: (time?: string) => void;
    onEditTask: (task: any) => void;
    refreshTrigger: number;
}

export default function TimeTableCarousel({
    currentDate,
    onDateChange,
    onNewTask,
    onEditTask,
    refreshTrigger
}: TimeTableCarouselProps) {
    const x = useMotionValue(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    // Track the displayed dates: [Prev, Current, Next]
    // We update these when "Snap" happens.
    // Actually, we can just rely on 'currentDate'.
    // Prev = subDays(currentDate, 1)
    // Next = addDays(currentDate, 1)

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.offsetWidth);
        }
        const handleResize = () => {
            if (containerRef.current) setWidth(containerRef.current.offsetWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = width / 3;
        const velocityThreshold = 500;
        
        const { offset, velocity } = info;
        
        let newIndex = 0; // 0 = Current

        if (offset.x > threshold || velocity.x > velocityThreshold) {
            newIndex = -1; // Prev
        } else if (offset.x < -threshold || velocity.x < -velocityThreshold) {
            newIndex = 1; // Next
        }

        // Animate snap
        const targetX = newIndex * -width;
        
        animate(x, targetX, {
            type: "spring",
            stiffness: 300,
            damping: 30,
            onComplete: () => {
                if (newIndex !== 0) {
                    // Update global date
                    const nextDate = newIndex === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1);
                    onDateChange(nextDate);
                    // Reset x to 0 instantly (because the new "Current" is now in center)
                    x.set(0);
                }
            }
        });
    };

    // If width is 0, don't render or just render static to avoid glitches
    if (width === 0 && typeof window !== 'undefined') {
        // Initial render, maybe just return centered content?
        // Or wait for effect.
        return <Box ref={containerRef} sx={{ height: '100%', width: '100%' }} />;
    }

    return (
        <Box 
            ref={containerRef} 
            sx={{ 
                height: '100%', 
                width: '100%', 
                overflow: 'hidden', 
                position: 'relative',
                // Ensure browser allows horizontal gestures to be captured by JS
                touchAction: 'pan-y' 
            }}
        >
            <motion.div
                style={{ 
                    x, 
                    display: 'flex', 
                    height: '100%', 
                    width: width * 3, // 3 Panels wide
                    marginLeft: -width // Center the middle panel
                }}
                drag="x"
                // Allow dragging within the bounds of the adjacent days
                dragConstraints={{ left: -width, right: width }}
                // Elasticity when hitting the edge (showing blank space beyond Prev/Next)
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                // Lock direction to avoid diagonal scrolling issues
                dragDirectionLock
            >
                {/* Prev Day */}
                <Box sx={{ width: width, height: '100%', flexShrink: 0 }} key="prev">
                    <TimeTable 
                        date={subDays(currentDate, 1)}
                        onNewTask={onNewTask}
                        onEditTask={onEditTask}
                        refreshTrigger={refreshTrigger}
                    />
                </Box>
                
                {/* Current Day */}
                <Box sx={{ width: width, height: '100%', flexShrink: 0 }} key="current">
                    <TimeTable 
                        date={currentDate}
                        onNewTask={onNewTask}
                        onEditTask={onEditTask}
                        refreshTrigger={refreshTrigger}
                    />
                </Box>

                {/* Next Day */}
                <Box sx={{ width: width, height: '100%', flexShrink: 0 }} key="next">
                    <TimeTable 
                        date={addDays(currentDate, 1)}
                        onNewTask={onNewTask}
                        onEditTask={onEditTask}
                        refreshTrigger={refreshTrigger}
                    />
                </Box>
            </motion.div>
        </Box>
    );
}
