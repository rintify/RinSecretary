'use client';

import { use } from 'react';
import TaskForm from '../../../components/TaskForm';

export const EditTaskForm = ({ taskId, onSuccess, isModal }: { taskId: string, onSuccess?: () => void, isModal?: boolean }) => {
    return <TaskForm taskId={taskId} onSuccess={onSuccess} isModal={isModal} />;
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TaskForm taskId={id} />;
}
