import { AppTask } from './task';
import { CalendarEvent, AlarmEvent } from './calendar';
import { SharedFile } from '@/app/components/modals/SharedItemModal';

/**
 * Checks if an item is an AppTask (DB Task).
 */
export function isAppTask(item: unknown): item is AppTask {
    if (!item || typeof item !== 'object') return false;
    return 'deadline' in item && 'progress' in item;
}

/**
 * Checks if an item is a CalendarEvent (Google or Alarm).
 */
export function isCalendarEvent(item: unknown): item is CalendarEvent {
    if (!item || typeof item !== 'object') return false;
    // Distinguish from AppTask by checking for startTime and absence of id starting with 'task-' 
    // or type === 'EVENT' | 'ALARM'
    return ('startTime' in item || 'endTime' in item) && !('deadline' in item);
}

/**
 * Checks if an item is a SharedFile.
 */
export function isSharedFile(item: unknown): item is SharedFile {
    if (!item || typeof item !== 'object') return false;
    return 'fileName' in item && 'filePath' in item;
}

/**
 * Checks if an item is an AlarmEvent.
 */
export function isAlarmEvent(item: unknown): item is AlarmEvent {
    if (!item || typeof item !== 'object') return false;
    return 'isSent' in item && 'time' in item;
}

/**
 * Checks specifically for ALARM type within CalendarEvent/AppTask context
 */
export function isAlarmType(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;
    return 'type' in item && (item as { type: string }).type === 'ALARM';
}
