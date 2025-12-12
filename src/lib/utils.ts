import { format, addHours, startOfDay, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

export const formatDate = (date: Date | string) => {
  return format(new Date(date), 'MM/dd (EEE)', { locale: ja });
};

export const formatTime = (date: Date | string) => {
  return format(new Date(date), 'HH:mm');
};

/**
 * Dateオブジェクトを "yyyy-MM-ddTHH:mm" 形式のISOライクな文字列に変換します。
 * type="datetime-local" のinput要素の値として使用されます。
 * ブラウザのローカル時刻に基づいてフォーマットされます。
 */
export const formatLocalIsoString = (date: Date): string => {
  const pad = (n: number) => n < 10 ? '0' + n : n;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
