'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
    IconButton, Box, Tooltip, Button, 
    CircularProgress, Divider
} from '@mui/material';
import { 
    Menu as MenuIcon, 
    MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import CustomDatePicker from '../ui/CustomDatePicker';
import { useRouter } from 'next/navigation';
import { subDays } from 'date-fns';
import JobListModal from '../modals/JobListModal';
import { useGlobalJobs } from '@/app/context/GlobalJobContext';

const getBusinessDate = () => {
    const now = new Date();
    if (now.getHours() < 4) {
        return subDays(now, 1);
    }
    return now;
};

export type ModalType = 'NONE' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT' | 'DETAIL_TASK' | 'DETAIL_EVENT' | 'EDIT_ALARM' | 'DETAIL_ALARM' | 'SETTINGS' | 'FREE_TIME' | 'BULK_CREATE' | 'IMMEDIATE_TASK' | 'IMMEDIATE_EVENT' | 'IMMEDIATE_ALARM' | 'REGULAR_TASK_SETTINGS' | 'DATA_USAGE' | 'EXPIRED_TASKS' | 'AI_CHAT' | 'MAIL_SETTINGS' | 'GOOGLE_SETTINGS' | 'BACKUP_SETTINGS' | 'SHARED_ITEM';

interface AppHeaderProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    isSyncing: boolean;
    syncError: boolean;
    isSyncedRecently: boolean;
    lastSyncedAt: {
        global: Date | null;
        events: { server: Date | null; client: Date | null } | null;
        tasks: Date | null;
        alarms: Date | null;
    };
    onOpenSyncModal: () => void;
    onOpenModal: (modal: ModalType, data?: any) => void;
}

import NavigationDrawer from './NavigationDrawer';

export default function AppHeader({
    currentDate,
    onDateChange,
    isSyncing,
    syncError,
    isSyncedRecently,
    lastSyncedAt,
    onOpenSyncModal,
    onOpenModal,
}: AppHeaderProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [jobListOpen, setJobListOpen] = useState(false);
    const router = useRouter();

    return (
        <Box sx={{ 
            height: '60px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            px: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexShrink: 0,
            zIndex: 1200,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0
        }}>
            {/* Date Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <Button 
                    onClick={() => setShowDatePicker(true)}
                    sx={{ 
                        color: 'text.primary',
                        textTransform: 'none',
                        fontSize: '1.4rem', 
                        fontWeight: 'bold',
                        minWidth: 'auto',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                        pl: 0,
                        justifyContent: 'flex-start'
                    }}
                >
                    {format(currentDate, 'MM/dd (E)', { locale: ja })}
                </Button>
                <CustomDatePicker 
                    open={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    value={currentDate}
                    onChange={onDateChange}
                />
                
                <Tooltip title={isSyncing ? "同期中..." : (syncError ? "認証エラー：再ログインしてください" : `最終同期: ${lastSyncedAt.global ? formatDistanceToNow(lastSyncedAt.global, { addSuffix: true, includeSeconds: true, locale: ja }) : '未同期'}`)}>
                    <Box 
                        onClick={onOpenSyncModal}
                        sx={{ 
                            ml: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            height: 24, 
                            width: 24, 
                            justifyContent: 'center',
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.8 }
                        }}
                    >
                        <AnimatePresence mode="wait">
                            {isSyncing ? (
                                <motion.div
                                    key="syncing"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <CircularProgress size={12} thickness={5} color="inherit" sx={{ opacity: 0.6, display: 'block' }} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="status-dot"
                                    initial={{ scale: 0.8 }}
                                    animate={{ 
                                        scale: 1,
                                        backgroundColor: syncError ? '#f44336' : (isSyncedRecently ? '#4caf50' : '#ff9800')
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    </Box>
                </Tooltip>
            </Box>

            {/* Right Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={() => onDateChange(getBusinessDate())} size="small" sx={{ mr: 0, color: 'text.secondary' }}>
                    <MyLocationIcon />
                </IconButton>
                <IconButton onClick={() => setDrawerOpen(true)}>
                    <MenuIcon />
                </IconButton>
                
                <NavigationDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onOpenModal={onOpenModal}
                    onOpenJobList={() => setJobListOpen(true)}
                />
            </Box>

            <JobListModal 
                open={jobListOpen} 
                onClose={() => setJobListOpen(false)}
                onViewResult={(job) => {
                    if (job.type === 'AI_CHAT' && job.result) {
                        try {
                            const result = JSON.parse(job.result);
                            const payload = job.payload ? JSON.parse(job.payload) : {};
                            
                            // Build messages array
                            let messages: any[] = [];
                            if (payload.messages && Array.isArray(payload.messages)) {
                                messages = payload.messages.map((m: any, idx: number) => ({
                                    id: `hist-${idx}`,
                                    role: m.role,
                                    content: m.content,
                                    images: m.images,
                                    timestamp: new Date()
                                }));
                            }
                            messages.push({
                                id: Date.now().toString(),
                                role: 'assistant',
                                content: result.content || '',
                                images: result.images,
                                timestamp: new Date()
                            });
                            
                            onOpenModal('AI_CHAT', { initialMessages: messages });
                        } catch (e) {
                            console.error('Failed to parse job result', e);
                        }
                    }
                }}
            />
        </Box>
    );
}
