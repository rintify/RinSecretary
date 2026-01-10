'use client'; 

import React, { useState, useEffect, useCallback } from 'react';
import { isSameDay, subDays } from 'date-fns';
import { Box, Backdrop, CircularProgress, Typography } from '@mui/material';

// Hooks
import { useTimeTableData } from '../hooks/useTimeTableData';
import { useMailSummary } from '../hooks/useMailSummary';

// Components
import AppHeader, { ModalType } from '../components/layout/AppHeader';
import ActionFabs from '../components/layout/ActionFabs';
import ModalController from '../components/modals/ModalController';
import TimeTableSwiper from '../components/TimeTableSwiper';
import { useSharedFileListener } from '../hooks/useSharedFileListener';

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
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState<number | { timestamp: number; force: boolean }>(0);

    // Custom hooks for data fetching (non-blocking)
    // Loading State Aggregation
    const [childLoadingCount, setChildLoadingCount] = useState(0);
    const handleChildLoadingChange = useCallback((isLoading: boolean) => {
        setChildLoadingCount(prev => {
            const newCount = prev + (isLoading ? 1 : -1);
            return Math.max(0, newCount);
        });
    }, []);

    // Unified Data Fetching (Now only Global Checks)
    // We only need numeric trigger here for useEffect dependency
    const numericTrigger = typeof calendarRefreshTrigger === 'number' ? calendarRefreshTrigger : calendarRefreshTrigger.timestamp;

    const { 
        // items, // Removed
        expiredCount,
        isSyncing, 
        lastSyncedAt, 
        isSyncedRecently, 
        syncError,
        refresh,
        updateSyncTimestamp,
        setFetchError
    } = useTimeTableData({ 
        currentDate, 
        refreshTrigger: numericTrigger + taskRefreshTrigger 
    });

    const globalIsSyncing = isSyncing || childLoadingCount > 0;

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

    const handleDataFreshness = useCallback((data: { 
        events: { server: number | null; client: number | null } | null; 
        tasks: number | null; 
        alarms: number | null 
    }) => {
        if (data.events && data.events.server && data.events.client) {
            updateSyncTimestamp('events', { server: data.events.server, client: data.events.client });
        }
        if (data.tasks) updateSyncTimestamp('tasks', data.tasks);
        if (data.alarms) updateSyncTimestamp('alarms', data.alarms);
    }, [updateSyncTimestamp]);

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
        
        const isCalendar = activeModal.includes('EVENT') || activeModal.includes('ALARM') || activeModal === 'SETTINGS' || activeModal === 'FREE_TIME';
        const isTask = activeModal.includes('TASK') || activeModal === 'BULK_CREATE' || activeModal === 'SETTINGS' || activeModal === 'FREE_TIME' || activeModal === 'EXPIRED_TASKS' || activeModal === 'REGULAR_TASK_SETTINGS';

        // Trigger updates - simplified trigger which will propagate to children
        if (isCalendar) {
            setCalendarRefreshTrigger(prev => {
                const val = typeof prev === 'number' ? prev : prev.timestamp;
                return val + 1;
            });
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
                    isSyncing={globalIsSyncing}
                    syncError={syncError}
                    isSyncedRecently={isSyncedRecently}
                    lastSyncedAt={lastSyncedAt}
                    onOpenSyncModal={() => setShowSyncModal(true)}
                    onOpenModal={handleOpenModal}
                />
                
                {/* Main Display */}
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', mt: '60px' }}>
                    <TimeTableSwiper 
                        currentDate={currentDate} 
                        onDateChange={setCurrentDate}
                        onNewTask={handleNewEvent} 
                        onEditTask={handleTaskClick}
                        refreshTrigger={
                            // If calendar trigger is object (forced), pass it directly (timestamp handles change).
                            // If task trigger changed more recently than calendar, we might loose force flag, but force is immediate.
                            // Better logic: 
                            typeof calendarRefreshTrigger === 'object' 
                                ? { timestamp: calendarRefreshTrigger.timestamp + taskRefreshTrigger, force: calendarRefreshTrigger.force }
                                : (calendarRefreshTrigger + taskRefreshTrigger)
                        }
                        expiredCount={expiredCount}
                        onOpenExpired={() => setActiveModal('EXPIRED_TASKS')}
                        // items={items} // Removed
                        isSyncing={globalIsSyncing} // Pass global for fallback spinner if needed
                        onLoadingChange={handleChildLoadingChange}
                        onDataFreshness={handleDataFreshness}
                        onDataError={setFetchError}
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
                    onCalendarRefresh={(force = false) => {
                        if (force) {
                            setCalendarRefreshTrigger({ timestamp: Date.now(), force: true });
                        } else {
                            // If currently object, switch to number (or just update timestamp but force=false)
                            setCalendarRefreshTrigger(Date.now());
                        }
                    }}
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
