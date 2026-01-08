'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
    IconButton, Box, Tooltip, Button, 
    Menu, MenuItem, ListItemIcon, ListItemText, 
    CircularProgress, Divider
} from '@mui/material';
import { 
    Menu as MenuIcon, 
    MyLocation as MyLocationIcon,
    AccessTime as AccessTimeIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    Notifications as AlarmIcon,
    DataUsage as DataUsageIcon,
    Chat as ChatIcon,
    Email as MailIcon,
    Google as GoogleIcon,
    CloudUpload as BackupIcon,
    TaskAlt as TaskIcon,
    AppRegistration as BulkIcon,
} from '@mui/icons-material';
import CustomDatePicker from '../ui/CustomDatePicker';
import { useRouter } from 'next/navigation';
import { subDays } from 'date-fns';

const getBusinessDate = () => {
    const now = new Date();
    if (now.getHours() < 4) {
        return subDays(now, 1);
    }
    return now;
};

export type ModalType = 'NONE' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT' | 'DETAIL_TASK' | 'DETAIL_EVENT' | 'EDIT_ALARM' | 'DETAIL_ALARM' | 'SETTINGS' | 'FREE_TIME' | 'BULK_CREATE' | 'IMMEDIATE_TASK' | 'IMMEDIATE_EVENT' | 'IMMEDIATE_ALARM' | 'REGULAR_TASK_SETTINGS' | 'DATA_USAGE' | 'EXPIRED_TASKS' | 'AI_CHAT' | 'MAIL_SETTINGS' | 'GOOGLE_SETTINGS' | 'BACKUP_SETTINGS';

interface AppHeaderProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    isSyncing: boolean;
    syncError: boolean;
    isSyncedRecently: boolean;
    lastSyncedAt: Date | null;
    onOpenSyncModal: () => void;
    onOpenModal: (modal: ModalType) => void;
}

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
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const router = useRouter();

    const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

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
                
                <Tooltip title={isSyncing ? "同期中..." : (syncError ? "認証エラー：再ログインしてください" : `最終同期: ${lastSyncedAt ? format(lastSyncedAt, 'HH:mm') : '未同期'}`)}>
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
                <IconButton onClick={handleMenuOpen}>
                    <MenuIcon />
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('EXPIRED_TASKS'); }}>
                        <ListItemIcon>
                            <WarningIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText sx={{ color: 'error.main' }}>期限切れタスク</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('FREE_TIME'); }}>
                        <ListItemIcon>
                            <AccessTimeIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>空き時間</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('BULK_CREATE'); }}>
                        <ListItemIcon>
                            <BulkIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>一括作成</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('SETTINGS'); }}>
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>設定</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('REGULAR_TASK_SETTINGS'); }}>
                        <ListItemIcon>
                            <TaskIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>定期タスク設定</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('DATA_USAGE'); }}>
                        <ListItemIcon>
                            <DataUsageIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>通信量</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('MAIL_SETTINGS'); }}>
                        <ListItemIcon>
                            <MailIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>メール設定</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('GOOGLE_SETTINGS'); }}>
                        <ListItemIcon>
                            <GoogleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Google設定</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); onOpenModal('BACKUP_SETTINGS'); }}>
                        <ListItemIcon>
                            <BackupIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>バックアップ設定</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={() => { handleMenuClose(); router.push('/mail-summaries'); }}>
                        <ListItemIcon>
                            <MailIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>メール要約履歴</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={async () => { 
                        handleMenuClose(); 
                        const { logout } = await import('@/lib/actions');
                        await logout();
                    }}>
                        <ListItemIcon>
                            <Box sx={{ color: 'error.main', display: 'flex' }}>
                                <SettingsIcon fontSize="small" sx={{ opacity: 0 }} />
                            </Box>
                        </ListItemIcon>
                        <ListItemText primaryTypographyProps={{ color: 'error' }}>ログアウト</ListItemText>
                    </MenuItem>
                </Menu>
            </Box>
        </Box>
    );
}
