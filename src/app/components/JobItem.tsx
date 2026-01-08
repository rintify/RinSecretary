'use client';

import React from 'react';
import { Box, Paper, Typography, IconButton, LinearProgress, CircularProgress, Tooltip } from '@mui/material';
import { Close as CloseIcon, Autorenew as ProcessingIcon, CheckCircle as SuccessIcon, Error as ErrorIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { Job } from '../context/GlobalJobContext';

export default function JobItem({ job, onCancel, onDismiss, onView }: { job: Job, onCancel: () => void, onDismiss: () => void, onView: () => void }) {
    const isFinished = job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED';
    const isRunning = job.status === 'RUNNING' || job.status === 'PENDING';

    const getIcon = () => {
        if (job.status === 'COMPLETED') return <SuccessIcon color="success" fontSize="small" />;
        if (job.status === 'FAILED') return <ErrorIcon color="error" fontSize="small" />;
        if (job.status === 'CANCELLED') return <CloseIcon color="disabled" fontSize="small" />;
        return <CircularProgress size={16} sx={{ mr: 0.5 }} />;
    };

    const getStatusColor = () => {
        if (job.status === 'FAILED') return 'error.main';
        if (job.status === 'COMPLETED') return 'success.main';
        return 'text.secondary';
    };

    return (
        <Paper 
            variant="outlined" 
            sx={{ 
                p: 1.5, 
                mb: 1, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                borderLeft: '4px solid',
                borderColor: job.status === 'RUNNING' ? 'primary.main' : (isFinished ? 'grey.300' : 'warning.main')
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getIcon()}
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {job.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: getStatusColor(), fontWeight: 'bold' }}>
                         {job.status}
                    </Typography>
                </Box>
                
                {isRunning && (
                    <LinearProgress 
                        variant={job.progress > 0 ? "determinate" : "indeterminate"} 
                        value={job.progress} 
                        sx={{ mt: 0.5, height: 4, borderRadius: 1 }} 
                    />
                )}
                
                {job.error && (
                    <Typography variant="caption" color="error" noWrap sx={{ display: 'block' }}>
                        {job.error}
                    </Typography>
                )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isFinished && job.type !== 'UPLOAD' && (
                    <Tooltip title="結果を表示">
                        <IconButton size="small" onClick={onView} color="primary">
                            <ViewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <IconButton 
                    size="small" 
                    onClick={isFinished ? onDismiss : onCancel}
                    sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
        </Paper>
    );
}
