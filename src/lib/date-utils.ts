import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// プラグインの有効化
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 営業日を取得する。
 * dayStartHour（デフォルト4時）より前の場合は前日扱い。
 * 戻り値はDateオブジェクトのまま互換性を保つ
 */
export function getBusinessDate(dayStartHour = 4): Date {
  const now = dayjs.tz();
  if (now.hour() < dayStartHour) {
    return now.subtract(1, 'day').toDate();
  }
  return now.toDate();
}

/**
 * 指定日の表示範囲（開始〜終了時刻）を取得する。
 * 例: dayStartHour=4 なら 当日4:00 〜 翌日4:00
 */
export function getDayRange(date: Date, dayStartHour = 4): { start: Date; end: Date } {
  const dayStart = dayjs(date).tz().startOf('day');
  const start = dayStart.add(dayStartHour, 'hour');
  const end = dayStart.add(1, 'day').add(dayStartHour, 'hour');
  return { start: start.toDate(), end: end.toDate() };
}

/**
 * Dateオブジェクトを "yyyy-MM-ddTHH:mm" 形式のローカルIso文字列に変換します。
 * type="datetime-local" の input要素の値として使用されます。
 */
export const formatLocalIsoString = (date: Date): string => {
  return dayjs(date).format('YYYY-MM-DDTHH:mm');
};
