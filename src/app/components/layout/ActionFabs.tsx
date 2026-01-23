'use client';

import { Box, Fab, Tooltip } from '@mui/material';
import { 
    Event as EventIcon, 
    TaskAlt as TaskIcon, 
    Note as MemoIcon,
    Notifications as AlarmIcon,
    Chat as ChatIcon,
    ContentPaste as PasteIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { EVENT_COLOR, TASK_COLOR, ALARM_COLOR, MEMO_COLOR } from '@/app/utils/colors';
import { ModalType } from './AppHeader';
import { useDevice } from '@/app/context/DeviceContext';
import { useToast } from '@/app/context/ToastContext';

interface ActionFabsProps {
    onOpenModal: (modal: ModalType, data?: any) => void;
    onPaste?: (text: string) => void;
}

export default function ActionFabs({ onOpenModal, onPaste }: ActionFabsProps) {
    const { isComputer, isInitialized } = useDevice();
    const { showToast } = useToast();

    const handlePasteClick = async () => {
        if (!onPaste) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                onPaste(text);
            } else {
                showToast('クリップボードが空です', 'warning');
            }
        } catch (error) {
            console.error('Clipboard read failed', error);
            showToast('貼り付けに失敗しました', 'error');
        }
    };

    return (
        <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', zIndex: 100 }}>
            {isInitialized && !isComputer && onPaste && (
                <Tooltip title="Paste from Clipboard" placement="left">
                    <Box>
                        <Fab 
                            aria-label="paste" 
                            onClick={handlePasteClick}
                            size="medium"
                            sx={{ bgcolor: 'secondary.main', color: '#fff', '&:hover': { bgcolor: 'secondary.dark', opacity: 0.9 } }}
                        >
                            <PasteIcon />
                        </Fab>
                    </Box>
                </Tooltip>
            )}
            
            <Tooltip title="New Task" placement="left">
                <Box>
                    <Fab 
                        aria-label="add task" 
                        onClick={() => onOpenModal('IMMEDIATE_TASK', null)}
                        size="medium"
                        sx={{ bgcolor: TASK_COLOR, color: '#fff', '&:hover': { bgcolor: TASK_COLOR, opacity: 0.9 } }}
                    >
                        <TaskIcon />
                    </Fab>
                </Box>
            </Tooltip>
            <Tooltip title="New Event" placement="left">
                <Box>
                    <Fab 
                        aria-label="add event" 
                        onClick={() => onOpenModal('IMMEDIATE_EVENT', { startTime: undefined })}
                        size="medium" 
                        sx={{ bgcolor: EVENT_COLOR, color: '#fff', '&:hover': { bgcolor: EVENT_COLOR, opacity: 0.9 } }}
                    >
                        <EventIcon />
                    </Fab>
                </Box>
            </Tooltip>
            <Tooltip title="New Alarm" placement="left">
                <Box>
                    <Fab 
                        aria-label="add alarm" 
                        onClick={() => onOpenModal('IMMEDIATE_ALARM', null)}
                        size="medium" 
                        sx={{ bgcolor: ALARM_COLOR, color: '#fff', '&:hover': { bgcolor: ALARM_COLOR, opacity: 0.9 } }}
                    >
                        <AlarmIcon />
                    </Fab>
                </Box>
            </Tooltip>
            <Tooltip title="New Memo" placement="left">
                <Box>
                    <Fab 
                        aria-label="view memos" 
                        component={Link}
                        href="/memos"
                        size="medium" 
                        sx={{ bgcolor: MEMO_COLOR, color: '#fff', '&:hover': { bgcolor: MEMO_COLOR, opacity: 0.9 } }}
                    >
                        <MemoIcon />
                    </Fab>
                </Box>
            </Tooltip>

            <Tooltip title="AI Chat" placement="left">
                <Box>
                    <Fab 
                        aria-label="ai chat" 
                        onClick={() => onOpenModal('AI_CHAT')}
                        size="medium" 
                        sx={{ bgcolor: '#f44336', color: '#fff', '&:hover': { bgcolor: '#d32f2f', opacity: 0.9 } }}
                    >
                        <ChatIcon />
                    </Fab>
                </Box>
            </Tooltip>
        </Box>
    );
}
