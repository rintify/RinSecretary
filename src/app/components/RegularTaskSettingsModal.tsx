'use client';

import { useState, useEffect } from 'react';
import { Dialog, Box, Typography, IconButton, Tabs, Tab, Switch, Stack, TextField, Button, DialogContent } from '@mui/material';
import { Close as CloseIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useToast } from '@/app/context/ToastContext';
import { useConfirm } from '@/app/context/ConfirmContext';

interface RegularTaskSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

interface ChecklistItem {
    text: string;
    checked: boolean;
    isPaused: boolean;
}

interface RegularTaskConfig {
    type: 'DAILY' | 'WEEKLY';
    checklist: ChecklistItem[];
}

export default function RegularTaskSettingsModal({ open, onClose }: RegularTaskSettingsModalProps) {
    const [tabIndex, setTabIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // Config states
    const [dailyConfig, setDailyConfig] = useState<RegularTaskConfig>({ type: 'DAILY', checklist: [] });
    const [weeklyConfig, setWeeklyConfig] = useState<RegularTaskConfig>({ type: 'WEEKLY', checklist: [] });

    useEffect(() => {
        if (open) {
            fetchConfigs();
        }
    }, [open]);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/regular-tasks');
            if (res.ok) {
                const data = await res.json();
                const daily = data.find((c: any) => c.type === 'DAILY');
                const weekly = data.find((c: any) => c.type === 'WEEKLY');

                if (daily) {
                    setDailyConfig({
                        type: 'DAILY',
                        checklist: JSON.parse(daily.checklist)
                    });
                }
                if (weekly) {
                    setWeeklyConfig({
                        type: 'WEEKLY',
                        checklist: JSON.parse(weekly.checklist)
                    });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!await confirm('Execute manual task generation?', { title: 'Manual Generation' })) return;
        setLoading(true);
        try {
            const res = await fetch('/api/regular-tasks/generate', { method: 'POST' });
            if(res.ok) {
                 showToast('Generation triggered.', 'success');
            } else {
                 throw new Error('Failed');
            }
        } catch (e) {
            console.error(e);
            showToast('Error triggering generation', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                saveConfig(dailyConfig),
                saveConfig(weeklyConfig)
            ]);
            
            
            onClose();
        } catch (e) {
            console.error(e);
            showToast('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveConfig = async (config: RegularTaskConfig) => {
        await fetch('/api/regular-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
    };

    const currentConfig = tabIndex === 0 ? dailyConfig : weeklyConfig;
    const updateCurrentConfig = (updates: Partial<RegularTaskConfig>) => {
        if (tabIndex === 0) {
            setDailyConfig({ ...dailyConfig, ...updates });
        } else {
            setWeeklyConfig({ ...weeklyConfig, ...updates });
        }
    };

    const handleAddChecklistItem = () => {
        const newChecklist = [...currentConfig.checklist, { text: '', checked: false, isPaused: false }];
        updateCurrentConfig({ checklist: newChecklist });
    };

    const handleRemoveChecklistItem = (index: number) => {
        const newChecklist = [...currentConfig.checklist];
        newChecklist.splice(index, 1);
        updateCurrentConfig({ checklist: newChecklist });
    };

    const handleChecklistItemChange = (index: number, text: string) => {
        const newChecklist = [...currentConfig.checklist];
        newChecklist[index].text = text;
        updateCurrentConfig({ checklist: newChecklist });
    };

    const handleItemPauseToggle = (index: number) => {
        const newChecklist = [...currentConfig.checklist];
        newChecklist[index].isPaused = !newChecklist[index].isPaused;
        updateCurrentConfig({ checklist: newChecklist });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight="bold">Regular Tasks</Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Box>
            
            <Tabs 
                value={tabIndex} 
                onChange={(e, v) => setTabIndex(v)} 
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
                indicatorColor="primary"
                textColor="primary"
            >
                <Tab label="Review (Daily)" />
                <Tab label="Cleaning (Weekly)" />
            </Tabs>

            <DialogContent dividers sx={{ p: 0, height: '60vh', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
                     {loading ? (
                         <Box display="flex" justifyContent="center" p={4}>
                            <Typography>Loading...</Typography>
                         </Box>
                     ) : (
                         <Stack spacing={3}>
                             <Box display="flex" justifyContent="space-between" alignItems="center" bgcolor="action.hover" p={2} borderRadius={2}>
                                 <Box>
                                     <Typography variant="subtitle1" fontWeight="bold">
                                         {tabIndex === 0 ? 'Daily Task' : 'Weekly Task'} Creation
                                     </Typography>
                                     <Typography variant="caption" color="text.secondary">
                                         {tabIndex === 0 ? 'Created everyday at 4:00 AM' : 'Created every Monday at 4:00 AM'}
                                     </Typography>
                                 </Box>
                             </Box>

                             <Box>
                                 <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                     <Typography variant="subtitle2">Checklist Items</Typography>
                                     <Button 
                                         startIcon={<AddIcon />} 
                                         size="small" 
                                         onClick={handleAddChecklistItem}
                                     >
                                         Add Item
                                     </Button>
                                 </Box>
                                 
                                 <Stack spacing={1}>
                                     {currentConfig.checklist.map((item, index) => (
                                         <Box key={index} display="flex" alignItems="center" gap={1} sx={{ opacity: item.isPaused ? 0.5 : 1 }}>
                                             <Switch 
                                                 checked={!item.isPaused}
                                                 onChange={() => handleItemPauseToggle(index)}
                                                 size="small"
                                                 color="primary"
                                             />
                                             <TextField 
                                                 value={item.text}
                                                 onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                                                 fullWidth
                                                 size="small"
                                                 placeholder="Task item..."
                                                 disabled={item.isPaused}
                                                 variant="standard"
                                                 sx={{ textDecoration: item.isPaused ? 'line-through' : 'none' }}
                                             />
                                             <IconButton 
                                                 size="small" 
                                                 onClick={() => handleRemoveChecklistItem(index)}
                                             >
                                                 <DeleteIcon fontSize="small" />
                                             </IconButton>
                                         </Box>
                                     ))}
                                     {currentConfig.checklist.length === 0 && (
                                         <Typography variant="caption" color="text.secondary" align="center" py={2}>
                                             No items defined.
                                         </Typography>
                                     )}
                                 </Stack>
                             </Box>
                         </Stack>
                     )}
                </Box>
            </DialogContent>

            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                    variant="outlined" 
                    onClick={handleGenerate}
                    disabled={saving || loading}
                    color="secondary"
                    sx={{ mr: 1 }}
                >
                    Generate Now
                </Button>
                <Button 
                    variant="contained" 
                    onClick={handleSave}
                    disabled={saving || loading}
                    sx={{ px: 4 }}
                >
                    Save
                </Button>
            </Box>
        </Dialog>
    );
}
