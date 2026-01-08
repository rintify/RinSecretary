'use client';

import React from 'react';
import { Box, Paper, Typography, IconButton, LinearProgress, CircularProgress, Tooltip, Snackbar, Alert } from '@mui/material';
import { Close as CloseIcon, Autorenew as ProcessingIcon, CheckCircle as SuccessIcon, Error as ErrorIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useGlobalJobs, Job, JobStatus } from '../context/GlobalJobContext';
import { AnimatePresence, motion } from 'framer-motion';
import AIChatModal, { Message } from './AIChatModal';
import JobItem from './JobItem';

import Draggable, { DraggableEventHandler } from 'react-draggable';

export default function JobMonitor() {
    const { jobs, removeJob, cancelJob } = useGlobalJobs(); // Removed activeInterface
    const [viewingAiJob, setViewingAiJob] = React.useState<{ open: boolean; messages: Message[] }>({ open: false, messages: [] });
    
    // Visibility State
    const [isVisible, setIsVisible] = React.useState(false);
    const [isDismissed, setIsDismissed] = React.useState(false); // Check if user dismissed it for this session
    const [isHovering, setIsHovering] = React.useState(false);
    const visibilityTimer = React.useRef<NodeJS.Timeout | null>(null);

    // Notification State
    const [notification, setNotification] = React.useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ 
        open: false, message: '', severity: 'success' 
    });
    const lastJobStatuses = React.useRef<Record<string, JobStatus>>({}); // Track last status to detect completion

    // Persistent Position
    const [position, setPosition] = React.useState<{ x: number, y: number } | null>(null);
    const nodeRef = React.useRef(null);

    React.useEffect(() => {
        const stored = localStorage.getItem('rin_job_monitor_pos');
        if (stored) {
            try {
                setPosition(JSON.parse(stored));
            } catch (e) {
                // Ignore
            }
        } else {
             setPosition({ x: 0, y: 0 }); // Default
        }
    }, []);

    const handleStop: DraggableEventHandler = (e, data) => {
        const newPos = { x: data.x, y: data.y };
        setPosition(newPos);
        localStorage.setItem('rin_job_monitor_pos', JSON.stringify(newPos));
    };

    // 1. Monitor Jobs for 0.5s rule AND completion
    React.useEffect(() => {
        const hasRunningJobs = jobs.some(j => j.status === 'RUNNING' || j.status === 'PENDING');
        
        // Check for completions
        jobs.forEach(job => {
            const lastStatus = lastJobStatuses.current[job.id];
            
            // Debug Log
            if (lastStatus && lastStatus !== job.status) {
                console.log(`[JobMonitor] Status Change: ${job.title} (${job.id}) ${lastStatus} -> ${job.status}`);
            }

            // If job WAS running/pending AND now is COMPLETED/FAILED
            if ((lastStatus === 'RUNNING' || lastStatus === 'PENDING') && job.status === 'COMPLETED') {
                console.log(`[JobMonitor] Notification Triggered: ${job.title} Completed`);
                setNotification({ open: true, message: `${job.title} が完了しました`, severity: 'success' });
            } else if ((lastStatus === 'RUNNING' || lastStatus === 'PENDING') && job.status === 'FAILED') {
                 console.log(`[JobMonitor] Notification Triggered: ${job.title} Failed`);
                 setNotification({ open: true, message: `${job.title} に失敗しました`, severity: 'error' });
            }
            
            // Update tracker
            lastJobStatuses.current[job.id] = job.status;
        });

        // Cleanup statuses for removed jobs
        const currentIds = new Set(jobs.map(j => j.id));
        Object.keys(lastJobStatuses.current).forEach(id => {
            if (!currentIds.has(id)) {
                delete lastJobStatuses.current[id];
            }
        });

        if (hasRunningJobs) {
            if (!isVisible && !visibilityTimer.current && !isDismissed) {
                // Start timer to show (only if not dismissed)
                visibilityTimer.current = setTimeout(() => {
                    setIsVisible(true);
                    visibilityTimer.current = null;
                }, 500); // 0.5s delay
            }
        } else {
            // No running jobs.
            // Reset dismissed state so new future jobs will show up
            if (isDismissed) setIsDismissed(false);

            if (visibilityTimer.current) {
                clearTimeout(visibilityTimer.current);
                visibilityTimer.current = null;
            }
        }
    }, [jobs, isVisible, isDismissed]);

    // 2. Auto-close on interaction (Global Click/KeyDown)
    React.useEffect(() => {
        const handleGlobalInteraction = (e: Event) => {
            if (!isVisible) return;
            if (isHovering) return; // Don't close if interacting with the monitor itself

            // Check if click target is inside the monitor (redundant check if isHovering works, but safer)
            const target = e.target as HTMLElement;
            if (nodeRef.current && (nodeRef.current as any).contains(target)) return;

            setIsVisible(false);
            setIsDismissed(true); // Treat interaction as dismissal for this session
        };

        if (isVisible) {
            window.addEventListener('click', handleGlobalInteraction, true); // Capture phase to catch early? Or bubble?
            // Use capture to ensure we catch it before others might stop propagation, 
            // but we want to allow the interaction to happen.
            // Actually 'true' (capture) is better to detect "any interaction".
            window.addEventListener('keydown', handleGlobalInteraction, true);
        }

        return () => {
            window.removeEventListener('click', handleGlobalInteraction, true);
            window.removeEventListener('keydown', handleGlobalInteraction, true);
        };
    }, [isVisible, isHovering]);

    if (!isVisible && jobs.length === 0) return null; // Completely hidden if no jobs and not visible
    // Note: User can close it manually, sending isVisible -> false. 
    // If jobs are still running, should it reappear after 0.5s? 
    // Logic above: `if (hasRunningJobs) { if (!isVisible && !visibilityTimer.current) ... }`
    // So yes, if they close it, it will reappear after 0.5s if still running. That might be annoying.
    // Maybe we need "dismissed for this session" state?
    // User said: "Show if > 0.5s". "Close on interaction".
    // If I close it, I probably don't want it back immediately for the SAME job.
    // But implementation above is simple compliance. Let's stick to it for now.

    if (!isVisible) return null; 
    if (!position) return null;

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
                setIsVisible(false); // Close monitor when viewing result
            } catch (e) {
                console.error('Failed', e);
            }
        }
    };

    const handleCloseAiChat = () => {
        setViewingAiJob({ open: false, messages: [] });
    };

    return (
        <>
            <Draggable
                nodeRef={nodeRef}
                position={position}
                onStop={handleStop}
                handle=".job-monitor-handle"
            >
                <Paper 
                    ref={nodeRef}
                    elevation={6}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    sx={{ 
                        position: 'fixed', 
                        bottom: 20, 
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
                        className="job-monitor-handle"
                        sx={{ 
                            p: 1, 
                            bgcolor: 'primary.main', 
                            color: 'primary.contrastText', 
                            cursor: 'move',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                         <Typography variant="subtitle2" sx={{ fontWeight: 'bold', pl: 1 }}>
                             バックグラウンドジョブ ({jobs.length})
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
            </Draggable>

            <AIChatModal 
                open={viewingAiJob.open} 
                onClose={handleCloseAiChat} 
                initialMessages={viewingAiJob.messages}
            />

            <Snackbar 
                open={notification.open} 
                autoHideDuration={4000} 
                onClose={() => setNotification(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert 
                    onClose={() => setNotification(prev => ({ ...prev, open: false }))} 
                    severity={notification.severity} 
                    sx={{ width: '100%' }}
                    variant="filled"
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </>
    );
}


// Local JobItem definition removed in favor of shared component

