
'use client';

import { useState, useRef } from 'react';
import CustomTimePicker from '../ui/CustomTimePicker';
import SimpleTextInputModal from '../ui/SimpleTextInputModal';
import { useRouter } from 'next/navigation';
import { TASK_COLOR } from '../../utils/colors';

interface ImmediateTaskFlowProps {
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
}

export default function ImmediateTaskFlow({ onClose, onSuccess, initialDate = new Date() }: ImmediateTaskFlowProps) {
    const [step, setStep] = useState<'TIME' | 'TITLE' | 'SUBMITTING'>('TIME');
    const [deadline, setDeadline] = useState(initialDate);
    const [title, setTitle] = useState('');
    const router = useRouter();
    const isProceeding = useRef(false);

    const handleTimeConfirm = (date: Date) => {
        isProceeding.current = true;
        setDeadline(date);
        setStep('TITLE');
        setTimeout(() => { isProceeding.current = false; }, 500);
    };

    const handleTitleConfirm = async (text: string) => {
        setTitle(text);
        setStep('SUBMITTING');

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: text,
                    deadline: deadline,
                    startDate: new Date(), // Set start date to now
                    progress: 0,
                    maxProgress: 100
                }),
            });

            if (res.ok) {
                onSuccess();
            } else {
                alert('Failed to create task');
                onClose();
            }
        } catch (e) {
            console.error(e);
            alert('Error creating task');
            onClose();
        }
    };

    // If step is SUBMITTED, we are done, usually onSuccess handles closing.
    // Ideally we show a loading indicator or just rely on the modals closing.

    return (
        <>
            <CustomTimePicker 
                open={step === 'TIME'}
                onClose={() => { if(!isProceeding.current && step === 'TIME') onClose(); }} 
                value={deadline}
                onChange={handleTimeConfirm}
                showDate={true}
                guideMessage="いつまでに？"
                accentColor={TASK_COLOR}
            />
            
            <SimpleTextInputModal 
                open={step === 'TITLE'}
                onClose={() => onClose()} 
                onConfirm={handleTitleConfirm}
                title="タスクのタイトル"
                placeholder="タスク名"
                guideMessage="何をする？"
                accentColor={TASK_COLOR}
            />
        </>
    );
}
