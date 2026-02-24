'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import DayView from './DayView';

import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper/types';
import { Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/virtual';

interface DaySwiperProps {
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  dayStartHour?: number;
}

const VIRTUAL_RANGE = 20000;
const INITIAL_INDEX = 10000;

export default function DaySwiper({ currentDate, onDateChange, dayStartHour = 4 }: DaySwiperProps) {
  const swiperRef = useRef<SwiperClass | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [anchorDate] = useState<Date>(() => currentDate);

  const slides = useMemo(() => Array.from({ length: VIRTUAL_RANGE + 1 }, (_, i) => i), []);

  // 外部からの日付変更をSwiperに反映
  useEffect(() => {
    if (!swiperRef.current) return;
    const diff = dayjs(currentDate).tz().startOf('day').diff(dayjs(anchorDate).tz().startOf('day'), 'day');
    const targetIndex = INITIAL_INDEX + diff;
    if (swiperRef.current.activeIndex !== targetIndex) {
      swiperRef.current.slideTo(targetIndex, 0, false);
    }
  }, [currentDate, anchorDate]);

  // ハイドレーション対策
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // レイアウトサイズの監視
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
    return () => observer.disconnect();
  }, [mounted]);

  const handleSlideChange = useCallback(
    (swiper: SwiperClass) => {
      const diff = swiper.activeIndex - INITIAL_INDEX;
      const newDate = dayjs(anchorDate).tz().add(diff, 'day').toDate();
      const diffCurrent = dayjs(newDate).tz().startOf('day').diff(dayjs(currentDate).tz().startOf('day'), 'day');
      if (diffCurrent !== 0) {
        onDateChange(newDate);
      }
    },
    [anchorDate, currentDate, onDateChange],
  );

  // レイアウト準備前はフォールバック表示
  if (!mounted || !isLayoutReady) {
    return (
      <Box ref={containerRef} sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
        <DayView date={currentDate} dayStartHour={dayStartHour} />
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Swiper
        modules={[Virtual]}
        spaceBetween={0}
        slidesPerView={1}
        initialSlide={INITIAL_INDEX}
        virtual={{
          slides,
          addSlidesAfter: 2,
          addSlidesBefore: 2,
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          const diff = dayjs(currentDate).tz().startOf('day').diff(dayjs(anchorDate).tz().startOf('day'), 'day');
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
        {slides.map((slideIndex) => {
          const diff = slideIndex - INITIAL_INDEX;
          const slideDate = dayjs(anchorDate).tz().add(diff, 'day').toDate();
          return (
            <SwiperSlide key={slideIndex} virtualIndex={slideIndex}>
              <Box sx={{ height: '100%', overflow: 'hidden' }}>
                <DayView date={slideDate} dayStartHour={dayStartHour} />
              </Box>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Box>
  );
}
