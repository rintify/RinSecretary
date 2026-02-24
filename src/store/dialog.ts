import { create } from 'zustand';

interface DialogState {
  // Event
  isEventDialogOpen: boolean;
  editingEventId: string | null;
  openEventDialog: (id?: string) => void;
  closeEventDialog: () => void;

  // Task
  isTaskDialogOpen: boolean;
  editingTaskId: string | null;
  openTaskDialog: (id?: string) => void;
  closeTaskDialog: () => void;

  // Alarm
  isAlarmDialogOpen: boolean;
  editingAlarmId: string | null;
  openAlarmDialog: (id?: string) => void;
  closeAlarmDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  isEventDialogOpen: false,
  editingEventId: null,
  openEventDialog: (id) => set({ isEventDialogOpen: true, editingEventId: id || null }),
  closeEventDialog: () => set({ isEventDialogOpen: false, editingEventId: null }),

  isTaskDialogOpen: false,
  editingTaskId: null,
  openTaskDialog: (id) => set({ isTaskDialogOpen: true, editingTaskId: id || null }),
  closeTaskDialog: () => set({ isTaskDialogOpen: false, editingTaskId: null }),

  isAlarmDialogOpen: false,
  editingAlarmId: null,
  openAlarmDialog: (id) => set({ isAlarmDialogOpen: true, editingAlarmId: id || null }),
  closeAlarmDialog: () => set({ isAlarmDialogOpen: false, editingAlarmId: null }),
}));
