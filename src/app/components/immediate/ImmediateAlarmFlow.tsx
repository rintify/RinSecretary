
'use client';

import { useState, useRef } from 'react';
import CustomTimePicker from '../ui/CustomTimePicker';
import SimpleTextInputModal from '../ui/SimpleTextInputModal';
import { createAlarm } from '@/lib/alarm-actions';
import { ALARM_COLOR } from '../../utils/colors';

interface ImmediateAlarmFlowProps {
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
}

export default function ImmediateAlarmFlow({ onClose, onSuccess, initialDate = new Date() }: ImmediateAlarmFlowProps) {
    const [step, setStep] = useState<'TIME' | 'TITLE' | 'SUBMITTING'>('TIME');
    const [time, setTime] = useState(initialDate);
    const [title, setTitle] = useState('');
    const isProceeding = useRef(false);

    const handleTimeConfirm = (date: Date) => {
        isProceeding.current = true;
        setTime(date);
        setStep('TITLE');
        setTimeout(() => { isProceeding.current = false; }, 500);
    };

    const handleTitleConfirm = async (text: string) => {
        setTitle(text);
        setStep('SUBMITTING');

        try {
            await createAlarm({
                title: text,
                time: time,
                comment: ''
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            alert('Error creating alarm');
            onClose();
        }
    };

    return (
        <>
            <CustomTimePicker 
                open={step === 'TIME'}
                onClose={() => { if(!isProceeding.current && step === 'TIME') onClose(); }}
                value={time}
                onChange={handleTimeConfirm}
                showDate={true}
                guideMessage="何時に？"
                accentColor={ALARM_COLOR}
            />
            
            <SimpleTextInputModal 
                open={step === 'TITLE'}
                onClose={() => onClose()} 
                onConfirm={handleTitleConfirm}
                title="アラームのタイトル"
                placeholder="アラーム名"
                guideMessage="アラーム名は？"
                accentColor={ALARM_COLOR}
            />
        </>
    );
}
