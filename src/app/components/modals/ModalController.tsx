'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, Box, DialogTitle, DialogActions, Typography, Button } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { isSameDay, subDays, format, formatDistanceToNow } from 'date-fns';
import { ModalType } from '../layout/AppHeader';
import { ja } from 'date-fns/locale';

// Static imports for frequently used lightweight modals
import TaskForm from '../TaskForm';
import EventForm from '../EventForm';
import TaskDetailModal from '../TaskDetailModal';
import EventDetailModal from '../EventDetailModal';
import AlarmForm from '../AlarmForm';
import AlarmDetailModal from '../AlarmDetailModal';

// Dynamic imports for heavy modals
const SettingsModal = dynamic(() => import('../SettingsModal'), { ssr: false });
const MailSettingsModal = dynamic(() => import('../MailSettingsModal'), { ssr: false });
const GoogleSettingsModal = dynamic(() => import('../GoogleSettingsModal'), { ssr: false });
const BackupSettingsModal = dynamic(() => import('../BackupSettingsModal'), { ssr: false });
const RegularTaskSettingsModal = dynamic(() => import('../RegularTaskSettingsModal'), { ssr: false });
const FreeTimeModal = dynamic(() => import('../FreeTimeModal'), { ssr: false });
const DataUsageModal = dynamic(() => import('../DataUsageModal'), { ssr: false });
const ExpiredTaskListModal = dynamic(() => import('../ExpiredTaskListModal'), { ssr: false });
const AIChatModal = dynamic(() => import('../AIChatModal'), { ssr: false });
const BulkEventCreator = dynamic(() => import('../BulkEventCreator'), { ssr: false });
const ImmediateTaskFlow = dynamic(() => import('../immediate/ImmediateTaskFlow'), { ssr: false });
const ImmediateEventFlow = dynamic(() => import('../immediate/ImmediateEventFlow'), { ssr: false });
const ImmediateAlarmFlow = dynamic(() => import('../immediate/ImmediateAlarmFlow'), { ssr: false });
const MailSummaryResultModal = dynamic(() => import('../mail/MailSummaryResultModal'), { ssr: false });
const SharedItemModal = dynamic(() => import('./SharedItemModal'), { ssr: false });
const LocalSettingsModal = dynamic(() => import('../LocalSettingsModal'), { ssr: false });

const SlideTransition = React.forwardRef(function Transition(
    props: TransitionProps & { children: React.ReactElement<any, any>; },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const getBusinessDate = () => {
    const now = new Date();
    if (now.getHours() < 4) {
        return subDays(now, 1);
    }
    return now;
};

interface ModalControllerProps {
    activeModal: ModalType;
    modalData: any;
    currentDate: Date;
    onCloseModal: (arg?: any) => void;
    onEditFromDetail: () => void;
    onTaskRefresh: () => void;
    onCalendarRefresh: (force?: boolean) => void;
    onTaskClick: (task: any) => void;
    // Sync Status Dialog
    showSyncModal: boolean;
    onCloseSyncModal: () => void;
    isSyncing: boolean;
    syncError: boolean;
    authError?: boolean;
    fetchError?: boolean;
    isSyncedRecently: boolean;
    lastSyncedAt: {
        global: Date | null;
        events: { server: Date | null; client: Date | null } | null;
        tasks: Date | null;
        alarms: Date | null;
    };
    // Mail Summary
    unreadSummaries: any[];
    showUnreadModal: boolean;
    onCloseUnreadModal: () => void;
}

export default function ModalController({
    activeModal,
    modalData,
    currentDate,
    onCloseModal,
    onEditFromDetail,
    onTaskRefresh,
    onCalendarRefresh,
    onTaskClick,
    showSyncModal,
    onCloseSyncModal,
    isSyncing,
    syncError,
    authError,
    fetchError,
    isSyncedRecently,
    lastSyncedAt,
    unreadSummaries,
    showUnreadModal,
    onCloseUnreadModal,
}: ModalControllerProps) {
    return (
        <>
            {/* Shared Dialog for form/detail modals */}
            <Dialog
                open={['NEW_EVENT', 'EDIT_TASK', 'EDIT_EVENT', 'DETAIL_TASK', 'DETAIL_EVENT', 'EDIT_ALARM', 'DETAIL_ALARM'].includes(activeModal)}
                onClose={onCloseModal}
                fullScreen={false}
                maxWidth={false}
                PaperProps={{
                    sx: {
                        width: '92%',
                        maxWidth: '600px',
                        m: 'auto',
                        borderRadius: 3
                    }
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <Suspense fallback={<Box p={4}>Loading...</Box>}>
                        {activeModal === 'EDIT_TASK' && (
                            <TaskForm 
                                taskId={modalData?.id} 
                                initialValues={modalData}
                                onSuccess={onCloseModal} 
                                isModal
                            />
                        )}
                        {activeModal === 'NEW_EVENT' && (
                            <EventForm
                                initialStartTime={modalData?.startTime}
                                onSuccess={onCloseModal}
                                isModal
                                initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                            />
                        )}
                        {activeModal === 'EDIT_EVENT' && (
                            <EventForm 
                                eventId={modalData?.id}
                                initialValues={modalData}
                                onSuccess={onCloseModal} 
                                isModal
                            />
                        )}
                        {activeModal === 'DETAIL_TASK' && (
                            <TaskDetailModal
                                task={modalData}
                                onClose={onCloseModal}
                                onEdit={onEditFromDetail}
                                onUpdate={onTaskRefresh}
                            />
                        )}
                        {activeModal === 'DETAIL_EVENT' && (
                            <EventDetailModal
                                event={modalData}
                                onClose={onCloseModal}
                                onEdit={onEditFromDetail}
                            />
                        )}
                        {activeModal === 'EDIT_ALARM' && (
                            <AlarmForm
                                alarmId={modalData?.id}
                                initialValues={modalData}
                                onSuccess={onCloseModal}
                                isModal
                            />
                        )}
                        {activeModal === 'DETAIL_ALARM' && (
                            <AlarmDetailModal
                                alarm={modalData}
                                onClose={onCloseModal}
                                onEdit={onEditFromDetail}
                            />
                        )}
                    </Suspense>
                </DialogContent>
            </Dialog>

            {/* Fullscreen Settings Dialog */}
            <Dialog
                open={activeModal === 'SETTINGS'}
                onClose={onCloseModal}
                fullScreen
                TransitionComponent={SlideTransition}
            >
                <SettingsModal onClose={onCloseModal} />
            </Dialog>

            {/* Fullscreen Mail Settings Dialog */}
            <Dialog
                open={activeModal === 'MAIL_SETTINGS'}
                onClose={onCloseModal}
                fullScreen
                TransitionComponent={SlideTransition}
            >
                <MailSettingsModal onClose={onCloseModal} />
            </Dialog>

            {/* Google Settings Modal */}
            <GoogleSettingsModal 
                open={activeModal === 'GOOGLE_SETTINGS'}
                onClose={onCloseModal}
            />

            {/* Backup Settings Modal */}
            <BackupSettingsModal
                open={activeModal === 'BACKUP_SETTINGS'}
                onClose={onCloseModal}
            />

            {/* Regular Task Settings Modal */}
            <RegularTaskSettingsModal
                open={activeModal === 'REGULAR_TASK_SETTINGS'}
                onClose={onCloseModal}
            />

            {/* Mail Summary Result Modal */}
            <MailSummaryResultModal
                open={showUnreadModal}
                onClose={onCloseUnreadModal}
                summaries={unreadSummaries}
                title="新着メール要約"
            />

            {/* Free Time Modal */}
            {activeModal === 'FREE_TIME' && (
                <FreeTimeModal onClose={onCloseModal} />
            )}

            {/* Data Usage Modal */}
            {activeModal === 'DATA_USAGE' && (
                <DataUsageModal open={true} onClose={onCloseModal} />
            )}

            {/* Expired Tasks Modal */}
            {activeModal === 'EXPIRED_TASKS' && (
                <ExpiredTaskListModal
                    open={true}
                    onClose={onCloseModal}
                    onEditTask={onTaskClick}
                />
            )}

            {/* AI Chat Modal */}
            {activeModal === 'AI_CHAT' && (
                <AIChatModal open={true} onClose={onCloseModal} initialMessages={modalData?.initialMessages} />
            )}

            {/* Local Settings Modal */}
            {activeModal === 'LOCAL_SETTINGS' && (
                <LocalSettingsModal open={true} onClose={onCloseModal} />
            )}

            {/* Immediate Action Flows */}
            {activeModal === 'SHARED_ITEM' && (
                <SharedItemModal
                    open={true}
                    onClose={onCloseModal}
                    sharedFile={modalData}
                />
            )}

            {/* Immediate Action Flows */}
            {activeModal === 'IMMEDIATE_TASK' && (
                <ImmediateTaskFlow
                    onClose={onCloseModal}
                    onSuccess={onCloseModal}
                    initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                />
            )}
            {activeModal === 'IMMEDIATE_EVENT' && (
                <ImmediateEventFlow
                    onClose={onCloseModal}
                    onSuccess={onCloseModal}
                    initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                />
            )}
            {activeModal === 'IMMEDIATE_ALARM' && (
                <ImmediateAlarmFlow
                    onClose={onCloseModal}
                    onSuccess={onCloseModal}
                    initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                />
            )}

            {/* Bulk Creator */}
            {activeModal === 'BULK_CREATE' && (
                <BulkEventCreator 
                    onBack={onCloseModal}
                    onSuccess={() => { onCloseModal(); onTaskRefresh(); }}
                    startWeekDate={currentDate}
                />
            )}

            {/* Sync Status Dialog */}
            <Dialog open={showSyncModal} onClose={onCloseSyncModal}>
                <DialogTitle>同期ステータス</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Box sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: syncError ? '#f44336' : (isSyncedRecently ? '#4caf50' : '#ff9800'),
                            mr: 1
                        }} />
                        <Typography variant="body1">
                            {authError ? "認証エラー" : (fetchError ? "データ取得エラー" : (syncError ? "エラー" : (isSyncedRecently ? "最新 (同期済み)" : "未同期 (時間経過)")))}
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        最終同期: {lastSyncedAt.global ? formatDistanceToNow(lastSyncedAt.global, { addSuffix: true, includeSeconds: true, locale: ja }) : '未同期'}
                    </Typography>
                    <Box sx={{ ml: 2, mb: 2 }}>
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                Googleカレンダー:
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 1 }}>
                                ・アプリ取得: {lastSyncedAt.events?.client ? formatDistanceToNow(lastSyncedAt.events.client, { addSuffix: true, includeSeconds: true, locale: ja }) : '-'}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 1 }}>
                                ・Google同期: {lastSyncedAt.events?.server ? formatDistanceToNow(lastSyncedAt.events.server, { addSuffix: true, includeSeconds: true, locale: ja }) : '-'}
                            </Typography>
                        </Box>
                        <Typography variant="caption" display="block" color="text.secondary">
                            タスク: {lastSyncedAt.tasks ? formatDistanceToNow(lastSyncedAt.tasks, { addSuffix: true, includeSeconds: true, locale: ja }) : '-'}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                            アラーム: {lastSyncedAt.alarms ? formatDistanceToNow(lastSyncedAt.alarms, { addSuffix: true, includeSeconds: true, locale: ja }) : '-'}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {authError 
                            ? "Googleアカウントの認証が切れています。再ログインしてください。" 
                            : (fetchError 
                                ? "データの取得に失敗しました。通信環境を確認するか、しばらく待ってから「最新にする」ボタンを押してください。"
                                : "通常は自動で同期されますが、ボタンを押して手動で更新することもできます。")
                        }
                    </Typography>
                    {authError && (
                        <Box sx={{ mt: 2 }}>
                            <Button 
                                variant="contained" 
                                color="error"
                                startIcon={<GoogleIcon />}
                                fullWidth
                                onClick={async () => {
                                    const { signIn } = await import('next-auth/react');
                                    await signIn('google', { callbackUrl: '/' });
                                }}
                            >
                                Googleに再ログイン
                            </Button>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCloseSyncModal}>閉じる</Button>
                    {!authError && (
                        <Button variant="contained" onClick={() => {
                            onTaskRefresh();
                            onCalendarRefresh(true); // Force refresh
                            onCloseSyncModal();
                        }}>
                            最新にする
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
}
