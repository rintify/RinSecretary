'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getJobs, cancelJob as cancelServerJob } from '@/app/actions/job';
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
}

const GlobalJobContext = createContext<GlobalJobContextType | null>(null);

export function GlobalJobProvider({ children }: { children: React.ReactNode }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    
    // Polling Interval
    useEffect(() => {
        const interval = setInterval(() => {
            refreshServerJobs();
        }, 5000); // Poll every 5 seconds
        
        refreshServerJobs(); // Initial fetch
        
        return () => clearInterval(interval);
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

    const removeJob = (id: string) => {
        setJobs(prev => prev.filter(j => j.id !== id));
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
        <GlobalJobContext.Provider value={{ jobs, addClientJob, updateClientJob, removeJob, refreshServerJobs, cancelJob }}>
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
