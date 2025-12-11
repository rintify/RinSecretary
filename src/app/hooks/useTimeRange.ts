import { useState, useEffect } from 'react';

interface UseTimeRangeProps {
    startTime: string;
    endTime: string;
    setStartTime: (val: string) => void;
    setEndTime: (val: string) => void;
    initialDuration?: number; // Optional initial duration in milliseconds
}

export const useTimeRange = ({ startTime, endTime, setStartTime, setEndTime, initialDuration }: UseTimeRangeProps) => {
    // Keep track of the last valid duration to use when shifting
    const [duration, setDuration] = useState<number>(initialDuration || 60 * 60 * 1000);

    // Update duration whenever valid start/end times exist and start < end
    useEffect(() => {
        if (!startTime || !endTime) return;

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start.getTime() < end.getTime()) {
            setDuration(end.getTime() - start.getTime());
        }
    }, [startTime, endTime]);

    const formatLocal = (date: Date) => {
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const updateStartTime = (val: string) => {
        setStartTime(val);

        if (!val || !endTime) return;

        const newStart = new Date(val);
        const currentEnd = new Date(endTime);

        if (isNaN(newStart.getTime()) || isNaN(currentEnd.getTime())) return;

        // If new start is after current end, push end forward to maintain duration
        if (newStart.getTime() > currentEnd.getTime()) {
            const newEnd = new Date(newStart.getTime() + duration);
            setEndTime(formatLocal(newEnd));
        }
    };

    const updateEndTime = (val: string) => {
        setEndTime(val);

        if (!val || !startTime) return;

        const newEnd = new Date(val);
        const currentStart = new Date(startTime);

        if (isNaN(newEnd.getTime()) || isNaN(currentStart.getTime())) return;

        // If new end is before current start, push start backward to maintain duration
        if (newEnd.getTime() < currentStart.getTime()) {
            const newStart = new Date(newEnd.getTime() - duration);
            setStartTime(formatLocal(newStart));
        }
    };

    return {
        updateStartTime,
        updateEndTime,
        duration
    };
};
