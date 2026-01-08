'use client';

import React from 'react';
import { Box, Paper, Typography, IconButton, LinearProgress, CircularProgress, Tooltip } from '@mui/material';
import { Close as CloseIcon, Autorenew as ProcessingIcon, CheckCircle as SuccessIcon, Error as ErrorIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useGlobalJobs, Job, JobStatus } from '../context/GlobalJobContext';
import { AnimatePresence, motion } from 'framer-motion';
import AIChatModal, { Message } from './AIChatModal';
import JobItem from './JobItem';

export default function JobMonitor() {
    const { jobs, removeJob, cancelJob } = useGlobalJobs();
    const [viewingAiJob, setViewingAiJob] = React.useState<{ open: boolean; messages: Message[] }>({ open: false, messages: [] });
    
    // Visibility State
    const [isVisible, setIsVisible] = React.useState(false);
    const [isDismissed, setIsDismissed] = React.useState(false);
    const [isHovering, setIsHovering] = React.useState(false);
    const visibilityTimer = React.useRef<NodeJS.Timeout | null>(null);

    const lastJobStatuses = React.useRef<Record<string, JobStatus>>({});
    const prevJobIds = React.useRef<Set<string>>(new Set());
    const nodeRef = React.useRef<HTMLDivElement>(null);

    // 1. Monitor Jobs for 0.5s rule and individual job removal after 0.4s
    const jobRemovalTimers = React.useRef<Record<string, NodeJS.Timeout>>({});

    React.useEffect(() => {
        // Track completion and set up removal timers
        jobs.forEach(job => {
            const lastStatus = lastJobStatuses.current[job.id];
            
            // If job just became COMPLETED or FAILED, set up removal timer
            if ((lastStatus === 'RUNNING' || lastStatus === 'PENDING') && 
                (job.status === 'COMPLETED' || job.status === 'FAILED')) {
                // Set timer to remove this job after 0.4s
                if (!jobRemovalTimers.current[job.id]) {
                    jobRemovalTimers.current[job.id] = setTimeout(() => {
                        removeJob(job.id);
                        delete jobRemovalTimers.current[job.id];
                    }, 400);
                }
            }
            
            // Update status tracker
            lastJobStatuses.current[job.id] = job.status;
        });

        // Cleanup for removed jobs
        const currentIds = new Set(jobs.map(j => j.id));
        Object.keys(lastJobStatuses.current).forEach(id => {
            if (!currentIds.has(id)) {
                delete lastJobStatuses.current[id];
                if (jobRemovalTimers.current[id]) {
                    clearTimeout(jobRemovalTimers.current[id]);
                    delete jobRemovalTimers.current[id];
                }
            }
        });
        const hasRunningJobs = jobs.some(j => j.status === 'RUNNING' || j.status === 'PENDING');
        const hasPendingRemovals = Object.keys(jobRemovalTimers.current).length > 0;

        if (hasRunningJobs || hasPendingRemovals) {
            // Check if there are any NEW running jobs (not seen before)
            const currentRunningIds = new Set(jobs.filter(j => j.status === 'RUNNING' || j.status === 'PENDING').map(j => j.id));
            const hasNewJob = [...currentRunningIds].some(id => !prevJobIds.current.has(id));
            
            if (hasNewJob) {
                if (isDismissed) {
                    setIsDismissed(false);
                }
            }
            
            prevJobIds.current = currentRunningIds;

            if (!isVisible && !visibilityTimer.current && !isDismissed) {
                visibilityTimer.current = setTimeout(() => {
                    setIsVisible(true);
                    visibilityTimer.current = null;
                }, 500);
            }
        } else {
            // No running or recently completed jobs
            if (isDismissed) setIsDismissed(false);
            prevJobIds.current = new Set();

            if (visibilityTimer.current) {
                clearTimeout(visibilityTimer.current);
                visibilityTimer.current = null;
            }

            // Hide when no jobs left
            if (isVisible) {
                setIsVisible(false);
            }
        }
    }, [jobs, isVisible, isDismissed, removeJob]);

    // 2. Auto-close on interaction (Global Click/KeyDown)
    React.useEffect(() => {
        const handleGlobalInteraction = (e: Event) => {
            if (!isVisible) return;
            if (isHovering) return;

            const target = e.target as HTMLElement;
            if (nodeRef.current && nodeRef.current.contains(target)) return;

            setIsVisible(false);
            setIsDismissed(true);
        };

        if (isVisible) {
            window.addEventListener('click', handleGlobalInteraction, true);
            window.addEventListener('keydown', handleGlobalInteraction, true);
        }

        return () => {
            window.removeEventListener('click', handleGlobalInteraction, true);
            window.removeEventListener('keydown', handleGlobalInteraction, true);
        };
    }, [isVisible, isHovering]);

    // Cleanup timers on unmount
    React.useEffect(() => {
        return () => {
            if (visibilityTimer.current) clearTimeout(visibilityTimer.current);
            Object.values(jobRemovalTimers.current).forEach(timer => clearTimeout(timer));
        };
    }, []);

    if (!isVisible) return null;

    const handleViewResult = (job: Job) => {
        if (job.type === 'AI_CHAT' && job.result) {
            try {
                const result = JSON.parse(job.result);
                const payload = job.payload ? JSON.parse(job.payload) : {};
                
                let messages: Message[] = [];
                if (payload.messages && Array.isArray(payload.messages)) {
                    messages = payload.messages.map((m: any, idx: number) => ({
                        id: `hist-${idx}`,
                        role: m.role,
                        content: m.content,
                        images: m.images,
                        timestamp: new Date()
                    }));
                }
                messages.push({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: result.content || '',
                    images: result.images,
                    timestamp: new Date()
                });
                setViewingAiJob({ open: true, messages });
                setIsVisible(false);
            } catch (e) {
                console.error('Failed', e);
            }
        }
    };

    const handleCloseAiChat = () => {
        setViewingAiJob({ open: false, messages: [] });
    };
    // Only show running/pending jobs in the list
    const runningJobs = jobs.filter(j => j.status === 'RUNNING' || j.status === 'PENDING');
    const hasRunningJobs = runningJobs.length > 0;

    return (
        <>
            <Paper 
                ref={nodeRef}
                elevation={6}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                sx={{ 
                    position: 'fixed', 
                    top: 70, 
                    right: 20, 
                    width: 320, 
                    zIndex: 9999,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box 
                    sx={{ 
                        p: 1, 
                        bgcolor: hasRunningJobs ? 'primary.main' : 'success.main', 
                        color: hasRunningJobs ? 'primary.contrastText' : 'success.contrastText', 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.3s ease'
                    }}
                >
                     <Typography variant="subtitle2" sx={{ fontWeight: 'bold', pl: 1 }}>
                         {hasRunningJobs 
                             ? `処理中... (${runningJobs.length}件)`
                             : `完了 (${jobs.length}件)`
                         }
                     </Typography>
                     <IconButton size="small" onClick={() => { setIsVisible(false); setIsDismissed(true); }} sx={{ color: 'inherit' }}>
                         <CloseIcon fontSize="small" />
                     </IconButton>
                </Box>

                <Box sx={{ maxHeight: 300, overflowY: 'auto', p: 1 }}>
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
                                    onView={() => handleViewResult(job)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </Box>
            </Paper>

            <AIChatModal 
                open={viewingAiJob.open} 
                onClose={handleCloseAiChat} 
                initialMessages={viewingAiJob.messages}
            />
        </>
    );
}
