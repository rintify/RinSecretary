'use client';

import React from 'react';
import { 
    Dialog, DialogTitle, DialogContent, 
    IconButton, Typography, Box 
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useGlobalJobs } from '../../context/GlobalJobContext';
import JobItem from '../JobItem';
import { motion, AnimatePresence } from 'framer-motion';

interface JobListModalProps {
    open: boolean;
    onClose: () => void;
    onViewResult: (job: any) => void;
}

export default function JobListModal({ open, onClose, onViewResult }: JobListModalProps) {
    const { jobs, removeJob, cancelJob } = useGlobalJobs();

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            disableScrollLock
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" component="span">ジョブ一覧 ({jobs.length})</Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, minHeight: 300 }}>
                 {jobs.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: 'text.secondary' }}>
                        <Typography>現在実行中のジョブはありません</Typography>
                    </Box>
                ) : (
                    <Box>
                         <AnimatePresence>
                            {jobs.map((job) => (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                     <JobItem 
                                        job={job} 
                                        onCancel={() => cancelJob(job.id)} 
                                        onDismiss={() => removeJob(job.id)} 
                                        onView={() => {
                                            onViewResult(job);
                                            onClose();
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
