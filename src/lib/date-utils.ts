import { subDays, startOfDay, addDays, addHours } from 'date-fns';

/**
 * 営業日を取得する。
 * dayStartHour（デフォルト4時）より前の場合は前日扱い。
 */
export function getBusinessDate(dayStartHour = 4): Date {
  const now = new Date();
  if (now.getHours() < dayStartHour) {
    return subDays(now, 1);
  }
  return now;
}

/**
 * 指定日の表示範囲（開始〜終了時刻）を取得する。
 * 例: dayStartHour=4 なら 当日4:00 〜 翌日4:00
 */
export function getDayRange(date: Date, dayStartHour = 4): { start: Date; end: Date } {
  const dayStart = startOfDay(date);
  const start = addHours(dayStart, dayStartHour);
  const end = addHours(addDays(dayStart, 1), dayStartHour);
  return { start, end };
}
