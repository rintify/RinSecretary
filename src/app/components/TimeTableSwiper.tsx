'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Box } from '@mui/material';
import TimeTable from './TimeTable';
import { TaskLocal } from './TimeTable';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';

import { Swiper as SwiperClass } from 'swiper/types';
import { Virtual } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/virtual';

interface TimeTableSwiperProps {
    currentDate: Date;
    onDateChange: (newDate: Date) => void;
    onNewTask: (time?: string) => void;
    onEditTask: (task: any) => void;
    refreshTrigger: number | { timestamp: number; force: boolean };
    expiredCount?: number;
    onOpenExpired?: () => void;

    // items: TaskLocal[]; // Removed
    isSyncing?: boolean;
    onLoadingChange?: (isLoading: boolean) => void;

    onDataFreshness?: (data: { 
        events: { server: number | null; client: number | null } | null; 
        tasks: number | null; 
        alarms: number | null 
    }) => void;
}

// Range of virtual slides. 
// 0 to 2000 => Center at 1000.
// +/- 1000 days (approx 2.7 years) is enough for session.
// If outside, we could reset, but let's assume it's enough.
const VIRTUAL_RANGE = 20000;
const INITIAL_INDEX = 10000;

export default function TimeTableSwiper({
    currentDate,
    onDateChange,
    onNewTask,
    onEditTask,
    refreshTrigger,
    expiredCount,
    onOpenExpired,
    // items, // Removed
    isSyncing,
    onLoadingChange,
    onDataFreshness
}: TimeTableSwiperProps) {
    const swiperRef = useRef<SwiperClass | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isLayoutReady, setIsLayoutReady] = useState(false);
    
    // We anchor the swiper to the date it was initially mounted with (or the first non-null date)
    // This stable anchor prevents index shifting during swipes.
    const [anchorDate] = useState<Date>(() => currentDate);

    // Create virtual slides array
    const slides = useMemo(() => Array.from({ length: VIRTUAL_RANGE + 1 }).map((_, i) => i), []);

    // Handle External Changes (DatePicker)
    useEffect(() => {
        if (!swiperRef.current || !anchorDate) return;
        
        // Calculate where the currentDate should be relative to anchorDate
        const diff = differenceInCalendarDays(currentDate, anchorDate);
        const targetIndex = INITIAL_INDEX + diff;
        
        if (swiperRef.current.activeIndex !== targetIndex) {
            swiperRef.current.slideTo(targetIndex, 0, false);
        }
    }, [currentDate, anchorDate]);

    // Hydration fix
    useEffect(() => {
        setMounted(true);
    }, []);

    // Layout Observer for PWA/Container Resizing
    useEffect(() => {
        if (!mounted || !containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { height, width } = entry.contentRect;
                if (height > 0 && width > 0) {
                    setIsLayoutReady(true);
                }
            }

            if (swiperRef.current && !swiperRef.current.destroyed) {
                requestAnimationFrame(() => {
                     swiperRef.current?.update();
                });
            }
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, [mounted]);

    const handleSlideChange = (swiper: SwiperClass) => {
        const activeIndex = swiper.activeIndex;
        // Calculate new date based on index diff from INITIAL
        const diff = activeIndex - INITIAL_INDEX;
        const newDate = addDays(anchorDate, diff);
        
        // Only trigger if different (to avoid loops, though date comparison handles it)
        if (differenceInCalendarDays(newDate, currentDate) !== 0) {
            onDateChange(newDate);
        }
    };

    // Force Swiper update removed - not needed as children fetch data independently now

    // Render fallback (static TimeTable) until layout is ready
    // This prevents Swiper from initializing with 0 height
    if (!mounted || !isLayoutReady) {
        return (
            <Box 
                ref={containerRef} // Attach ref here too for early detection
                sx={{ height: '100%', width: '100%', overflow: 'hidden' }}
            >
                <TimeTable 
                     date={currentDate}
                     onNewTask={onNewTask}
                     onEditTask={onEditTask}
                     refreshTrigger={refreshTrigger}
                     expiredCount={expiredCount}
                     onOpenExpired={onOpenExpired}
                     // items={items} // Removed
                     // isLoading={isSyncing} // Removed
                     onLoadingChange={onLoadingChange}
                     onDataFreshness={onDataFreshness}
                 />
            </Box>
        );
    }

    return (
        <Box 
            ref={containerRef}
            sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
        >
            <Box sx={{ px: 2, pt: 1, zIndex: 10 }}>

            </Box>
            <Swiper
                modules={[Virtual]}
                spaceBetween={0}
                slidesPerView={1}
                initialSlide={INITIAL_INDEX}
                virtual={{
                    slides: slides,
                    addSlidesAfter: 2, // Preload neighbor
                    addSlidesBefore: 2,
                    renderExternalUpdate: false // Allow React to manage updates
                }}
                onSwiper={(swiper) => {
                    swiperRef.current = swiper;
                    // Ensure we start at the correct index if currentDate != anchorDate (rare case on mount but possible)
                    const diff = differenceInCalendarDays(currentDate, anchorDate);
                    if (diff !== 0) {
                       swiper.slideTo(INITIAL_INDEX + diff, 0, false);
                    }
                }}
                onSlideChange={handleSlideChange}
                style={{ width: '100%', flex: 1 }}
                touchStartPreventDefault={false}
                observer={true}
                observeParents={true}
            >
                {slides.map((slideIndex, index) => {
                    // Calculate date for this specific slide index
                    // slideIndex is just the number from 0 to 2000
                    const diff = slideIndex - INITIAL_INDEX;
                    const date = addDays(anchorDate, diff);
                    
                    return (
                        <SwiperSlide key={slideIndex} virtualIndex={slideIndex}>
                             <Box sx={{ height: '100%', overflow: 'hidden' }}>
                                <TimeTable 
                                    date={date}
                                    onNewTask={onNewTask}
                                    onEditTask={onEditTask}
                                    refreshTrigger={refreshTrigger}
                                    expiredCount={expiredCount}
                                    onOpenExpired={onOpenExpired}
                                    // items={items} // Removed
                                    // isLoading={isSyncing} // Removed
                                    onLoadingChange={onLoadingChange}
                                    onDataFreshness={onDataFreshness}
                                />
                            </Box>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </Box>
    );
}
