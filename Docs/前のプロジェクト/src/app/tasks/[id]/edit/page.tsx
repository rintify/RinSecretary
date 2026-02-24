'use client';

import { use } from 'react';
import TaskForm from '../../../components/TaskForm';



export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TaskForm taskId={id} />;
}
