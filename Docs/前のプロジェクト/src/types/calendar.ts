export type AppEventType = 'EVENT' | 'ALARM' | 'TASK';

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: string | Date;
    endTime: string | Date;
    type: AppEventType;
    color?: string;
    memo?: string | null;
}

export interface GoogleCalendarEvent {
    id: string;
    summary?: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
}

export interface AlarmEvent {
    id: string;
    title: string;
    time: Date;
    comment?: string | null;
    isSent: boolean;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}
