'use client';

import React, { useState } from 'react';
import {
    Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Collapse, Divider, Typography, IconButton
} from '@mui/material';
import {
    ExpandLess, ExpandMore,
    TaskOutlined as TaskIcon,
    WarningAmberOutlined as WarningIcon,
    AccessTimeOutlined as AccessTimeIcon,
    AppRegistrationOutlined as BulkIcon,
    DataUsageOutlined as DataUsageIcon,
    EmailOutlined as MailIcon,
    SettingsOutlined as SettingsIcon,
    Google as GoogleIcon,
    CloudUploadOutlined as BackupIcon,
    LogoutOutlined as LogoutIcon,
    Close as CloseIcon,
    CheckCircleOutline as CheckIcon,
    BuildOutlined as ToolIcon,
    PhonelinkOff as LocalSettingsIcon
} from '@mui/icons-material';
import { ModalType } from './AppHeader';
import { useRouter } from 'next/navigation';

interface NavigationDrawerProps {
    open: boolean;
    onClose: () => void;
    onOpenModal: (modal: ModalType, data?: any) => void;
    onOpenJobList: () => void;
}

export default function NavigationDrawer({
    open,
    onClose,
    onOpenModal,
    onOpenJobList
}: NavigationDrawerProps) {
    const router = useRouter();
    
    // State for collapsible sections
    const [openSections, setOpenSections] = useState({
        check: true,
        tools: true,
        settings: false
    });

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleItemClick = (action: () => void) => {
        action();
        onClose();
    };

    const handleLogout = async () => {
        onClose();
        const { logout } = await import('@/lib/actions');
        await logout();
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { 
                    width: 280,
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            {/* Header (Minimalist) */}
            <Box sx={{ 
                p: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', pl: 1 }}>
                    Menu
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Scrollable Content Area */}
            <Box sx={{ overflowY: 'auto', flex: 1 }}>
                <List component="nav" sx={{ pt: 0 }}>
                    
                    {/* 1. CHECK Group */}
                    <ListItemButton onClick={() => toggleSection('check')}>
                        <ListItemIcon>
                            <CheckIcon />
                        </ListItemIcon>
                        <ListItemText primary="確認" />
                        {openSections.check ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                    
                    <Collapse in={openSections.check} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(onOpenJobList)}>
                                <ListItemIcon>
                                    <TaskIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="ジョブ一覧" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('EXPIRED_TASKS'))}>
                                <ListItemIcon>
                                    <WarningIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="期限切れタスク" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => router.push('/mail-summaries'))}>
                                <ListItemIcon>
                                    <MailIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="メール要約履歴" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('DATA_USAGE'))}>
                                <ListItemIcon>
                                    <DataUsageIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="通信量確認" />
                            </ListItemButton>
                        </List>
                    </Collapse>

                    <Divider sx={{ my: 1, mx: 2 }} />

                    {/* 2. TOOLS Group */}
                    <ListItemButton onClick={() => toggleSection('tools')}>
                        <ListItemIcon>
                            <ToolIcon />
                        </ListItemIcon>
                        <ListItemText primary="ツール" />
                        {openSections.tools ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>

                    <Collapse in={openSections.tools} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('FREE_TIME'))}>
                                <ListItemIcon>
                                    <AccessTimeIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="空き時間" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('BULK_CREATE'))}>
                                <ListItemIcon>
                                    <BulkIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="一括作成" />
                            </ListItemButton>
                        </List>
                    </Collapse>

                    <Divider sx={{ my: 1, mx: 2 }} />

                    {/* 3. SETTINGS Group */}
                    <ListItemButton onClick={() => toggleSection('settings')}>
                        <ListItemIcon>
                            <SettingsIcon />
                        </ListItemIcon>
                        <ListItemText primary="設定" />
                        {openSections.settings ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>

                    <Collapse in={openSections.settings} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('SETTINGS'))}>
                                <ListItemIcon>
                                    <SettingsIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="AI / 通知設定" secondary="モデル, Pushover, Discord" secondaryTypographyProps={{ fontSize: '0.7rem' }} />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('REGULAR_TASK_SETTINGS'))}>
                                <ListItemIcon>
                                    <TaskIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="定期タスク設定" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('MAIL_SETTINGS'))}>
                                <ListItemIcon>
                                    <MailIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="メール連携設定" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('GOOGLE_SETTINGS'))}>
                                <ListItemIcon>
                                    <GoogleIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Google連携設定" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('BACKUP_SETTINGS'))}>
                                <ListItemIcon>
                                    <BackupIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="バックアップ設定" />
                            </ListItemButton>

                            <ListItemButton sx={{ pl: 4 }} onClick={() => handleItemClick(() => onOpenModal('LOCAL_SETTINGS'))}>
                                <ListItemIcon>
                                    <LocalSettingsIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="ローカル設定" secondary="オフラインモード" secondaryTypographyProps={{ fontSize: '0.7rem' }} />
                            </ListItemButton>
                        </List>
                    </Collapse>

                </List>
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* Logout */}
            <Box sx={{ flexShrink: 0 }}>
                <List>
                    <ListItemButton onClick={handleLogout} sx={{ my: 1 }}>
                        <ListItemIcon>
                            <LogoutIcon />
                        </ListItemIcon>
                        <ListItemText primary="ログアウト" />
                    </ListItemButton>
                </List>
            </Box>
        </Drawer>
    );
}
