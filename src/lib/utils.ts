import { format, addHours, startOfDay, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

export const formatDate = (date: Date | string) => {
  return format(new Date(date), 'MM/dd (EEE)', { locale: ja });
};

export const formatTime = (date: Date | string) => {
  return format(new Date(date), 'HH:mm');
};
