'use client';

import { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Alert, CircularProgress } from '@mui/material';
import { getPushoverSettings, updatePushoverSettings } from '@/lib/user-actions';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [userKey, setUserKey] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        getPushoverSettings().then(settings => {
            if (settings) {
                setUserKey(settings.pushoverUserKey || '');
                setToken(settings.pushoverToken || '');
            }
            setLoading(false);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await updatePushoverSettings(userKey, token);
            setMessage({ text: 'Settings saved successfully!', type: 'success' });
            setTimeout(onClose, 1000);
        } catch (e) {
            console.error(e);
            setMessage({ text: 'Failed to save settings.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Box p={4} textAlign="center"><CircularProgress /></Box>;

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h5" fontWeight="bold">Settings</Typography>
            
            <Alert severity="info" sx={{ mb: 1 }}>
                Configure Pushover for Alarm notifications.
            </Alert>

            <TextField 
                label="Pushover User Key"
                value={userKey}
                onChange={(e) => setUserKey(e.target.value)}
                fullWidth
            />

            <TextField 
                label="Pushover API Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                fullWidth
            />

            {message && (
                <Alert severity={message.type}>
                    {message.text}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                    type="submit" 
                    variant="contained" 
                    disabled={saving}
                    size="large"
                    fullWidth
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </Box>

            <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider', pt: 2 }}>
                 <Button 
                    variant="outlined" 
                    color="error" 
                    fullWidth 
                    onClick={async () => {
                        const { logout } = await import('@/lib/actions');
                        await logout();
                    }}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );
}
