
'use client';

import { useState, useRef } from 'react';
import CustomTimePicker from '../ui/CustomTimePicker';
import DurationPickerModal from '../ui/DurationPickerModal';
import SimpleTextInputModal from '../ui/SimpleTextInputModal';
import { createGoogleEvent } from '@/lib/calendar-actions';
import { addMinutes } from 'date-fns';
import { EVENT_COLOR } from '../../utils/colors';

interface ImmediateEventFlowProps {
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
}

export default function ImmediateEventFlow({ onClose, onSuccess, initialDate = new Date() }: ImmediateEventFlowProps) {
    const [step, setStep] = useState<'TIME' | 'DURATION' | 'TITLE' | 'SUBMITTING'>('TIME');
    const [startTime, setStartTime] = useState(initialDate);
    const [duration, setDuration] = useState(60);
    const [title, setTitle] = useState('');
    const isProceeding = useRef(false);

    const handleTimeConfirm = (date: Date) => {
        isProceeding.current = true;
        setStartTime(date);
        setStep('DURATION');
        setTimeout(() => { isProceeding.current = false; }, 500);
    };

    const handleDurationConfirm = (minutes: number) => {
        setDuration(minutes);
        setStep('TITLE');
    };

    const handleTitleConfirm = async (text: string) => {
        setTitle(text);
        setStep('SUBMITTING');

        try {
            const endTime = addMinutes(startTime, duration);
            await createGoogleEvent({
                title: text,
                startTime: startTime,
                endTime: endTime,
                memo: ''
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            alert('Error creating event');
            onClose();
        }
    };

    return (
        <>
            <CustomTimePicker 
                open={step === 'TIME'}
                onClose={() => { if(!isProceeding.current && step === 'TIME') onClose(); }}
                value={startTime}
                onChange={handleTimeConfirm}
                showDate={true}
                guideMessage="いつから？"
                accentColor={EVENT_COLOR}
            />
            
            <DurationPickerModal
                open={step === 'DURATION'}
                onClose={() => onClose()}
                onConfirm={handleDurationConfirm}
                initialDuration={60}
                guideMessage="どのくらい？"
                accentColor={EVENT_COLOR}
            />

            <SimpleTextInputModal 
                open={step === 'TITLE'}
                onClose={() => onClose()} 
                onConfirm={handleTitleConfirm}
                title="イベントのタイトル"
                placeholder="イベント名"
                guideMessage="何をする？"
                accentColor={EVENT_COLOR}
            />
        </>
    );
}
