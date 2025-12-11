'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { Box } from '@mui/material';
import TimeTable from './TimeTable';
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
    refreshTrigger: number;
}

// Range of virtual slides. 
// 0 to 2000 => Center at 1000.
// +/- 1000 days (approx 2.7 years) is enough for session.
// If outside, we could reset, but let's assume it's enough.
const VIRTUAL_RANGE = 2000;
const INITIAL_INDEX = 1000;

export default function TimeTableSwiper({
    currentDate,
    onDateChange,
    onNewTask,
    onEditTask,
    refreshTrigger
}: TimeTableSwiperProps) {
    const swiperRef = useRef<SwiperClass | null>(null);
    const [mounted, setMounted] = useState(false);
    
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

    if (!mounted) {
        // Render fallback (static TimeTable for currentDate)
        return (
            <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                <TimeTable 
                     date={currentDate}
                     onNewTask={onNewTask}
                     onEditTask={onEditTask}
                     refreshTrigger={refreshTrigger}
                 />
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', width: '100%' }}>
            <Swiper
                modules={[Virtual]}
                spaceBetween={0}
                slidesPerView={1}
                initialSlide={INITIAL_INDEX}
                virtual={{
                    slides: slides,
                    addSlidesAfter: 2, // Preload neighbor
                    addSlidesBefore: 2
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
                style={{ width: '100%', height: '100%' }}
                touchStartPreventDefault={false}
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
                                />
                            </Box>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </Box>
    );
}
