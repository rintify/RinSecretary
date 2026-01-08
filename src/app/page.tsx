'use client'; 

import React, { useState } from 'react';
import { isSameDay, subDays } from 'date-fns';
import { Box, Backdrop, CircularProgress, Typography } from '@mui/material';

// Hooks
import { useTimeTableData } from './hooks/useTimeTableData';
import { useMailSummary } from './hooks/useMailSummary';

// Components
import AppHeader, { ModalType } from './components/layout/AppHeader';
import ActionFabs from './components/layout/ActionFabs';
import ModalController from './components/modals/ModalController';
import TimeTableSwiper from './components/TimeTableSwiper';
import { useSharedFileListener } from './hooks/useSharedFileListener';

const getBusinessDate = () => {
    const now = new Date();
    if (now.getHours() < 4) {
        return subDays(now, 1);
    }
    return now;
};

export default function Home() {
    const [currentDate, setCurrentDate] = useState(getBusinessDate());
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [activeModal, setActiveModal] = useState<ModalType>('NONE');
    const [modalData, setModalData] = useState<any>(null);
    
    // Refresh triggers
    const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0);
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

    // Custom hooks for data fetching (non-blocking)
    // Unified Data Fetching
    const { 
        items,
        expiredCount,
        isSyncing, 
        lastSyncedAt, 
        isSyncedRecently, 
        syncError,
        refresh
    } = useTimeTableData({ 
        currentDate, 
        refreshTrigger: calendarRefreshTrigger + taskRefreshTrigger 
    });

    const { 
        unreadSummaries, 
        showUnreadModal, 
        setShowUnreadModal 
    } = useMailSummary();

    // Modal handlers
    const handleOpenModal = React.useCallback((modal: ModalType, data?: any) => {
        setModalData(data ?? null);
        setActiveModal(modal);
    }, []);

    // Shared File Listener (Drag & Drop / Paste / Polling)
    const { handlePaste, handleDrop, handleDragOver } = useSharedFileListener({ 
        onOpenModal: handleOpenModal, 
        currentDate 
    });

    React.useEffect(() => {
        window.addEventListener('paste', handlePaste as any);
        window.addEventListener('drop', handleDrop as any);
        window.addEventListener('dragover', handleDragOver as any);

        return () => {
            window.removeEventListener('paste', handlePaste as any);
            window.removeEventListener('drop', handleDrop as any);
            window.removeEventListener('dragover', handleDragOver as any);
        };
    }, [handlePaste, handleDrop, handleDragOver]);

    const handleNewEvent = (startTime?: string) => {
        setModalData({ startTime });
        setActiveModal('NEW_EVENT');
    };

    const handleTaskClick = (task: any) => {
        setModalData(task);
        if (task.deadline) {
            setActiveModal('DETAIL_TASK');
        } else if (task.type === 'ALARM') {
            setActiveModal('DETAIL_ALARM');
        } else {
            setActiveModal('DETAIL_EVENT');
        }
    };

    const handleEditFromDetail = () => {
        if (modalData?.deadline) {
            setActiveModal('EDIT_TASK');
        } else if (modalData?.type === 'ALARM') {
            setActiveModal('EDIT_ALARM');
        } else {
            setActiveModal('EDIT_EVENT');
        }
    };

    const handleCloseModal = (arg?: any) => {
        const closingModal = activeModal;
        setActiveModal('NONE');
        setModalData(null);
        
        const isCalendar = closingModal.includes('EVENT') || closingModal.includes('ALARM') || closingModal === 'SETTINGS' || closingModal === 'FREE_TIME';
        const isTask = closingModal.includes('TASK') || closingModal === 'BULK_CREATE' || closingModal === 'SETTINGS' || closingModal === 'FREE_TIME' || closingModal === 'EXPIRED_TASKS' || closingModal === 'REGULAR_TASK_SETTINGS';

        if (isCalendar) {
            setCalendarRefreshTrigger(prev => prev + 1);
        }
        if (isTask) {
            setTaskRefreshTrigger(prev => prev + 1);
        }

        if (arg instanceof Date) {
            const itemDate = arg;
            const businessDate = itemDate.getHours() < 4 ? subDays(itemDate, 1) : itemDate;
            setCurrentDate(businessDate);
        }
    };

    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
                {/* Header */}
                <AppHeader
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    isSyncing={isSyncing}
                    syncError={syncError}
                    isSyncedRecently={isSyncedRecently}
                    lastSyncedAt={lastSyncedAt}
                    onOpenSyncModal={() => setShowSyncModal(true)}
                    onOpenModal={handleOpenModal}
                />
                
                {/* Main Display */}
                <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', mt: '60px', height: 'calc(100dvh - 60px)' }}>
                    <TimeTableSwiper 
                        currentDate={currentDate} 
                        onDateChange={setCurrentDate}
                        onNewTask={handleNewEvent} 
                        onEditTask={handleTaskClick}
                        refreshTrigger={taskRefreshTrigger}
                        expiredCount={expiredCount}
                        onOpenExpired={() => setActiveModal('EXPIRED_TASKS')}
                        items={items}
                        isSyncing={isSyncing}
                    />
                    
                    {/* FABs */}
                    <ActionFabs onOpenModal={handleOpenModal} />
                </Box>

                {/* All Modals */}
                <ModalController
                    activeModal={activeModal}
                    modalData={modalData}
                    currentDate={currentDate}
                    onCloseModal={handleCloseModal}
                    onEditFromDetail={handleEditFromDetail}
                    onTaskRefresh={() => setTaskRefreshTrigger(prev => prev + 1)}
                    onCalendarRefresh={() => setCalendarRefreshTrigger(prev => prev + 1)}
                    onTaskClick={handleTaskClick}
                    showSyncModal={showSyncModal}
                    onCloseSyncModal={() => setShowSyncModal(false)}
                    isSyncing={isSyncing}
                    syncError={syncError}
                    isSyncedRecently={isSyncedRecently}
                    lastSyncedAt={lastSyncedAt}
                    unreadSummaries={unreadSummaries}
                    showUnreadModal={showUnreadModal}
                    onCloseUnreadModal={() => setShowUnreadModal(false)}
                />
            </Box>
    );
}
