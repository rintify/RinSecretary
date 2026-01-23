'use client';

import { useState, useEffect } from 'react';
import { fetchMyUnreadMailSummaries } from '@/lib/mail-scheduler-actions';
import { MailSummary } from '@prisma/client';

interface UseMailSummaryReturn {
    unreadSummaries: MailSummary[];
    showUnreadModal: boolean;
    setShowUnreadModal: (show: boolean) => void;
}

export function useMailSummary(): UseMailSummaryReturn {
    const [unreadSummaries, setUnreadSummaries] = useState<MailSummary[]>([]);
    const [showUnreadModal, setShowUnreadModal] = useState(false);

    useEffect(() => {
        fetchMyUnreadMailSummaries().then(res => {
            if (res.success && res.summaries && res.summaries.length > 0) {
                setUnreadSummaries(res.summaries);
                setShowUnreadModal(true);
            }
        }).catch(console.error);
    }, []);

    return {
        unreadSummaries,
        showUnreadModal,
        setShowUnreadModal,
    };
}
