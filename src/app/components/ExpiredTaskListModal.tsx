'use client';

import { useState, useEffect } from 'react';
import { 
    Dialog, DialogContent, Box, Typography, IconButton, 
    Button, Menu, MenuItem, CircularProgress,
    Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { Close as CloseIcon, Update as UpdateIcon, Warning as WarningIcon } from '@mui/icons-material';
import React from 'react';
import { getExpiredTasks, extendTaskDeadline, ignoreExpiredTask, ExtensionType } from '@/lib/task-actions';
import { motion, AnimatePresence } from 'framer-motion';
import TaskItem from './TaskItem';
import TaskDetailModal from './TaskDetailModal';

import TaskForm from './TaskForm';
import { useToast } from '@/app/context/ToastContext';

// Transition for full screen dialog
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface Task {
    id: string;
    title: string;
    deadline?: Date | string; 
    startTime?: Date | string;
    endTime?: Date | string;
    type?: string; 
    progress?: number; 
    maxProgress?: number;
    memo?: string;
    color?: string;
    startDate?: Date | string;
    [key: string]: any;
}

interface ExpiredTaskListModalProps {
    open: boolean;
    onClose: () => void;
    // We don't need onEditTask anymore as we handle it internally, 
    // unless we want to use the parent's generic modal system.
    // But user requested "Stacking", so internal management is better.
    onEditTask?: (task: any) => void; 
}

export default function ExpiredTaskListModal({ open, onClose, onEditTask }: ExpiredTaskListModalProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [extendingId, setExtendingId] = useState<string | null>(null);

    // Editing State (Stacking)
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);

    // Menu State
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { showToast } = useToast();

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const data = await getExpiredTasks(30);
             // Map nulls to undefined to match Task interface
            const mappedData = data.map(t => ({
                ...t,
                memo: t.memo || undefined,
                deadline: t.deadline ? new Date(t.deadline) : undefined,
                startDate: t.startDate ? new Date(t.startDate) : undefined,
                createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
                updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            }));
            setTasks(mappedData);
        } catch (e) {
            console.error('Failed to fetch expired tasks', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchTasks();
        }
    }, [open]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: string) => {
        setAnchorEl(event.currentTarget);
        setSelectedTaskId(taskId);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedTaskId(null);
    };

    const handleExtend = async (type: ExtensionType) => {
        if (!selectedTaskId) return;
        
        const taskId = selectedTaskId;
        handleMenuClose();
        setExtendingId(taskId); 

        try {
            await extendTaskDeadline(taskId, type);
            // Optimistic update: remove from list
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) {
            console.error('Failed to extend task', e);
            showToast('期限の延長に失敗しました', 'error');
        } finally {
            setExtendingId(null);
        }
    };

    const handleIgnore = async () => {
        if (!selectedTaskId) return;
        const taskId = selectedTaskId;
        handleMenuClose();
        setExtendingId(taskId);

        try {
            await ignoreExpiredTask(taskId);
            // Don't remove from list (User wants it to stay visually)
            // But fetch to update timestamp? or just force refresh?
            fetchTasks(); 
        } catch (e) {
            console.error('Failed to ignore task', e);
            showToast('操作に失敗しました', 'error');
        } finally {
            setExtendingId(null);
        }
    };

    const handleTaskClick = (task: Task) => {
        setEditingTask(task);
    };

    const handleDetailClose = () => {
        setEditingTask(null);
        fetchTasks(); // Refresh list on close in case something changed
    };

    const handleDetailEdit = () => {
        // Switch from Detail to Edit Form
        // We keep editingTask set, but maybe open another dialog?
        // Or swap? Swapping is cleaner if we consider 'Detail' and 'Edit' as levels.
        setIsEditFormOpen(true);
    };

    const handleEditFormClose = () => {
        setIsEditFormOpen(false);
        // Maybe keep Detail open? Or close all?
        // Usually Save -> Close All. Cancel -> Back to Detail?
        // Let's assume Close All or Back to Detail.
        // If we want Back to Detail, we keep editingTask.
        // If we want Close All, we setEditingTask(null).
        // Let's Refresh and go back to Detail.
        fetchTasks();
    };

    const handleEditFormSuccess = () => {
        setIsEditFormOpen(false);
        setEditingTask(null); // Close everything on success? Or back to detail?
        // User probably finishes work. Close all stack.
        // Actually, if I edit date and it is no longer expired, it should vanish.
        fetchTasks();
    };

    return (
        <>
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
            PaperProps={{
                sx: { bgcolor: '#fff5f5' } // Light red background to indicate urgency
            }}
        >
            {/* Header */}
            <Box sx={{ 
                height: 60, 
                display: 'flex', 
                alignItems: 'center', 
                px: 2, 
                borderBottom: 1, 
                borderColor: 'divider',
                bgcolor: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, color: 'error.main' }}>
                    <WarningIcon sx={{ mr: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                        期限切れタスク
                    </Typography>
                </Box>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 2, bgcolor: '#fff5f5' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress color="error" />
                    </Box>
                ) : tasks.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, color: 'text.secondary' }}>
                        <WarningIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                        <Typography>期限切れのタスクはありません</Typography>
                        <Button onClick={onClose} sx={{ mt: 2 }}>閉じる</Button>
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={2}>
                        <AnimatePresence mode="popLayout">
                            {/* Unconfirmed Tasks (Sorted by deadline DESC) */}
                            {tasks
                                .filter(t => !(t.updatedAt && t.deadline && new Date(t.updatedAt) >= new Date(t.deadline)))
                                .sort((a, b) => (b.deadline ? new Date(b.deadline).getTime() : 0) - (a.deadline ? new Date(a.deadline).getTime() : 0))
                                .map(task => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <TaskItem 
                                            task={task} 
                                            onClick={handleTaskClick}
                                            action={
                                                 <Button
                                                    variant="outlined" 
                                                    color="error"
                                                    onClick={(e) => handleMenuOpen(e, task.id)}
                                                    disabled={extendingId === task.id}
                                                    size="small"
                                                    sx={{ 
                                                        minWidth: 'auto', 
                                                        px: 1,
                                                        py: 0.5,
                                                        bgcolor: 'white',
                                                        '&:hover': { bgcolor: '#ffebee' },
                                                        borderRadius: 1
                                                    }}
                                                >
                                                    <Box display="flex" flexDirection="column" alignItems="center">
                                                        <UpdateIcon fontSize="small" />
                                                        <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.65rem', lineHeight: 1 }}>延長</Typography>
                                                    </Box>
                                                </Button>
                                            }
                                        />
                                    </motion.div>
                            ))}
                            
                            {/* Confirmed Tasks Divider & List */}
                            {tasks.some(t => t.updatedAt && t.deadline && new Date(t.updatedAt) >= new Date(t.deadline)) && (
                                <>
                                    <Box sx={{ my: 2, display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                        <Typography variant="caption" sx={{ mx: 2, color: 'text.secondary' }}>確認済み</Typography>
                                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                                    </Box>

                                    {tasks
                                        .filter(t => t.updatedAt && t.deadline && new Date(t.updatedAt) >= new Date(t.deadline))
                                        .sort((a, b) => (b.deadline ? new Date(b.deadline).getTime() : 0) - (a.deadline ? new Date(a.deadline).getTime() : 0))
                                        .map(task => (
                                            <motion.div
                                                key={task.id}
                                                layout
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <TaskItem 
                                                    task={task} 
                                                    onClick={handleTaskClick}
                                                    style={{
                                                        opacity: 0.6,
                                                        backgroundColor: '#f5f5f5',
                                                    }}
                                                    action={
                                                         <Button
                                                            variant="outlined" 
                                                            color="error"
                                                            onClick={(e) => handleMenuOpen(e, task.id)}
                                                            disabled={extendingId === task.id}
                                                            size="small"
                                                            sx={{ 
                                                                minWidth: 'auto', 
                                                                px: 1,
                                                                py: 0.5,
                                                                bgcolor: 'white',
                                                                '&:hover': { bgcolor: '#ffebee' },
                                                                borderRadius: 1
                                                            }}
                                                        >
                                                            <Box display="flex" flexDirection="column" alignItems="center">
                                                                <UpdateIcon fontSize="small" />
                                                                <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.65rem', lineHeight: 1 }}>延長</Typography>
                                                            </Box>
                                                        </Button>
                                                    }
                                                />
                                            </motion.div>
                                    ))}
                                </>
                            )}
                        </AnimatePresence>
                    </Box>
                )}
            </DialogContent>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: { minWidth: 150 }
                }}
            >
                <MenuItem onClick={handleIgnore} sx={{ borderBottom: 1, borderColor: 'divider', mb: 1, fontWeight: 'bold' }}>
                    無視 (既読にする)
                </MenuItem>
                <MenuItem onClick={() => handleExtend('today')}>今日中 (23:59)</MenuItem>
                <MenuItem onClick={() => handleExtend('tomorrow')}>明日 (23:59)</MenuItem>
                <MenuItem onClick={() => handleExtend('afterTomorrow')}>明後日 (23:59)</MenuItem>
                <MenuItem onClick={() => handleExtend('week')}>1週間後 (23:59)</MenuItem>
            </Menu>
        </Dialog>

        {/* Nested Detail Modal */}
        {editingTask && (
            <Dialog 
                open={!isEditFormOpen} 
                onClose={handleDetailClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogContent sx={{ p: 0 }}>
                    <TaskDetailModal 
                        task={editingTask} 
                        onClose={handleDetailClose}
                        onEdit={handleDetailEdit}
                        onUpdate={() => {
                            // Update local list if progress changed?
                            // fetchTasks will be called on handleDetailClose effectively if we close.
                            // But onUpdate might be called without closing.
                            fetchTasks();
                        }}
                    />
                </DialogContent>
            </Dialog>
        )}

        {/* Nested Edit Form (Stacked on Detail or replacing it?)
            Material UI Dialogs stack by default based on render order or z-index.
            If we render both, the second one (Edit Form) should be on top.
        */}
        {isEditFormOpen && editingTask && (
            <Dialog 
                open={true} 
                onClose={handleEditFormClose}
                maxWidth="sm"
                fullWidth
            >
                 <DialogContent sx={{ p: 0 }}>
                    <TaskForm 
                        taskId={editingTask.id}
                        initialValues={editingTask}
                        onSuccess={handleEditFormSuccess}
                        isModal
                    />
                 </DialogContent>
            </Dialog>
        )}
        </>
    );
}
