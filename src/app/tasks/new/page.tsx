'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TaskForm from '../../components/TaskForm';

function NewTaskFormWrapper({ onSuccess, isModal }: { onSuccess?: () => void, isModal?: boolean }) {
    const searchParams = useSearchParams();
    const startTime = searchParams.get('startTime') || undefined;
    const initialValues = startTime ? { startDate: startTime } : undefined;
    return <TaskForm initialValues={initialValues} onSuccess={onSuccess} isModal={isModal} />;
}

export default function NewTaskPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewTaskFormWrapper />
        </Suspense>
    );
}

// Export specific wrapper for Home modal usage if needed, or Home can just use TaskForm directly.
// But Home currently imports NewTaskForm. I should probably just export a component that Home can use or Home should change imports.
// To keep compatibility with Home's current import if I don't change Home immediately:
export const NewTaskForm = NewTaskFormWrapper; // Re-export as named for compatibility if needed during transitions, though I will update Home too.
