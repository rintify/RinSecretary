export interface AppTask {
    id: string;
    title: string;
    memo?: string | null;
    startDate: Date;
    deadline: Date;
    progress: number;
    maxProgress: number;
    checklist: string; // JSON string
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TaskChecklistItem {
    text: string;
    checked: boolean;
}
