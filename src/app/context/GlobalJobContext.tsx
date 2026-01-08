'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getJobs, cancelJob as cancelServerJob, deleteJob } from '@/app/actions/job';
import { JobType } from '@/app/actions/job';

// Job Definition
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Job {
    id: string;
    type: string; // "AI_CHAT" | "BACKUP" | "UPLOAD" (Client)
    status: JobStatus;
    title: string;
    progress: number;
    error?: string;
    result?: string;
    isClient: boolean; // True for uploads, False for server jobs
    payload?: any;
    createdAt?: Date;
}

interface GlobalJobContextType {
    jobs: Job[];
    addClientJob: (job: Omit<Job, 'status' | 'progress' | 'isClient'>) => void;
    updateClientJob: (id: string, updates: Partial<Job>) => void;
    removeJob: (id: string) => void; 
    refreshServerJobs: () => Promise<void>;
    cancelJob: (id: string) => Promise<void>;
    activeInterface: string | null;
    setActiveInterface: (name: string | null) => void;
}

const GlobalJobContext = createContext<GlobalJobContextType | null>(null);

export function GlobalJobProvider({ children }: { children: React.ReactNode }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [activeInterface, setActiveInterface] = useState<string | null>(null);
    
    // SSE Connection
    useEffect(() => {
        let eventSource: EventSource | null = null;

        const connect = () => {
            eventSource = new EventSource('/api/jobs/stream');
            
            eventSource.onopen = () => {
                // Connected
                console.log('SSE Connected');
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'update') {
                        refreshServerJobs();
                    }
                } catch (e) {
                    // Ignore keep-alive or malformed
                }
            };
            
            eventSource.onerror = (err) => {
                console.error('SSE Error', err);
                eventSource?.close();
                // Browser might not auto-reconnect if we close it? 
                // EventSource standard says it retries. But if we close it manually, we need to retry?
                // Actually standard EventSource retries on connection lost. 
                // But if it fails on initial connection (401 etc), it might stop.
                // Let's rely on standard retry for now, but if closed, maybe retry in 5s.
                setTimeout(connect, 5000); 
            };
        };

        connect();
        refreshServerJobs(); // Initial fetch

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);

    const refreshServerJobs = async () => {
        try {
            const serverJobs = await getJobs();
            setJobs(currentJobs => {
                // Merge server jobs with existing client jobs
                const clientJobs = currentJobs.filter(j => j.isClient);
                
                const formattedServerJobs: Job[] = serverJobs.map(sj => ({
                    id: sj.id,
                    type: sj.type,
                    status: sj.status as JobStatus,
                    title: getJobTitle(sj.type, sj.payload),
                    progress: sj.progress,
                    result: sj.result || undefined,
                    isClient: false,
                    payload: sj.payload, // Ensure payload is passed through
                    createdAt: sj.createdAt
                }));

                return [...clientJobs, ...formattedServerJobs].sort((a,b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
            });
        } catch (e) {
            console.error("Failed to fetch jobs", e);
        }
    };

    const addClientJob = (job: Omit<Job, 'status' | 'progress' | 'isClient'>) => {
        const newJob: Job = {
            ...job,
            status: 'RUNNING',
            progress: 0,
            isClient: true,
            createdAt: new Date()
        };
        setJobs(prev => [newJob, ...prev]);
    };

    const updateClientJob = (id: string, updates: Partial<Job>) => {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
    };

    const removeJob = async (id: string) => {
        // Optimistic update
        setJobs(prev => prev.filter(j => j.id !== id));
        
        // Remove from DB (or mark as hidden)
        // If it's a client job, it's just local state. If server, delete it.
        const target = jobs.find(j => j.id === id);
        if (target && !target.isClient) {
            try {
                await deleteJob(id);
            } catch (e) {
                console.error("Failed to delete job", e);
                // Revert on error? Or just suppress.
                // Suppressing is better UX for "dismiss", user doesn't care if it failed secretly as long as it's gone from view.
            }
        }
    };

    const cancelJob = async (id: string) => {
        const target = jobs.find(j => j.id === id);
        if (!target) return;

        if (target.isClient) {
            // Client job cancellation logic depends on the caller checking the status
            // We just mark it here, and the caller (useEffect/UploadTask) handles abort.
            updateClientJob(id, { status: 'CANCELLED' });
        } else {
            // Server job
            await cancelServerJob(id);
            await refreshServerJobs();
        }
    };

    return (
        <GlobalJobContext.Provider value={{ jobs, addClientJob, updateClientJob, removeJob, refreshServerJobs, cancelJob, activeInterface, setActiveInterface }}>
            {children}
        </GlobalJobContext.Provider>
    );
}

export function useGlobalJobs() {
    const context = useContext(GlobalJobContext);
    if (!context) throw new Error("useGlobalJobs must be used within GlobalJobProvider");
    return context;
}

// Helper to format titles
function getJobTitle(type: string, payloadStr: string | null): string {
    if (type === 'BACKUP') return 'バックアップ作成';
    if (type === 'MAIL_SUMMARY') return 'メール要約生成';
    if (type === 'AI_CHAT') return 'AI回答生成';
    return type;
}
