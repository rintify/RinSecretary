'use client';

import { Dialog, DialogContent, IconButton, Typography, Box, useTheme, useMediaQuery, MenuItem, Select, FormControl } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { format, subDays, eachDayOfInterval, startOfDay, addMinutes } from 'date-fns';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DataUsageModalProps {
  open: boolean;
  onClose: () => void;
}

const getDailyKey = (date: Date) => `rin_data_usage_log_${format(date, 'yyyy-MM-dd')}`;

export default function DataUsageModal({ open, onClose }: DataUsageModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);
  const [todayUsage, setTodayUsage] = useState(0);
  
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = () => {
    try {
      const now = new Date();
      const key = getDailyKey(now);
      const storageData = localStorage.getItem(key);
      let dailyLog: number[] = new Array(288).fill(0);
      
      if (storageData) {
          try {
              const parsed = JSON.parse(storageData);
              if (Array.isArray(parsed)) dailyLog = parsed;
          } catch {}
      }

      const data: { x: number; y: number }[] = [];
      const baseDate = startOfDay(now);
      let sum = 0;

      for (let i = 0; i < 288; i++) {
          const d = addMinutes(baseDate, i * 5);
          const bytes = dailyLog[i] || 0;
          const mb = bytes / (1024 * 1024);
          
          data.push({ x: d.getTime(), y: parseFloat(mb.toFixed(2)) });
          sum += bytes;
      }
      
      setChartData(data);
      setTodayUsage(sum);
    } catch (e) {
      console.error('Failed to load data usage:', e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getInitialRange = () => {
    const now = new Date().getTime();
    return {
      min: now - 30 * 60 * 1000,
      max: now + 30 * 60 * 1000
    };
  };

  const initialRange = getInitialRange();

  const chartOptions: ApexOptions = {
      chart: {
          type: 'area',
          zoom: {
            enabled: true,
            type: 'x', 
            autoScaleYaxis: true
          },
          toolbar: {
             show: false,
             autoSelected: 'zoom' 
          },
          fontFamily: theme.typography.fontFamily
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'stepline', width: 2 },
      fill: {
          type: 'gradient',
          gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.4,
              opacityTo: 0.1,
              stops: [0, 90, 100]
          }
      },
      xaxis: {
          type: 'datetime',
          min: initialRange.min,
          max: initialRange.max,
          labels: {
              datetimeUTC: false,
              datetimeFormatter: {
                  year: 'yyyy',
                  month: 'MM/dd',
                  day: 'MM/dd',
                  hour: 'HH:mm'
              },
              style: { fontSize: '10px' }
          },
          tooltip: { enabled: false }
      },
      yaxis: {
          labels: {
             formatter: (val) => val.toFixed(1),
             style: { fontSize: '10px' }
          },
      },
      tooltip: {
          x: {
              format: 'HH:mm'
          },
          y: {
              formatter: (val) => `${val} MB`,
              title: { formatter: () => '通信量: ' }
          }
      },
      colors: [theme.palette.primary.main]
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      PaperProps={{
          sx: {
              borderRadius: fullScreen ? 0 : 3,
              m: fullScreen ? 0 : 2,
              height: fullScreen ? '100%' : 'auto',
              maxHeight: fullScreen ? 'none' : '80vh'
          }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 0 }}>
         <Typography variant="h6" fontWeight="bold">通信量</Typography>
         <IconButton onClick={onClose} edge="end" size="small">
            <CloseIcon />
         </IconButton>
      </Box>

      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', textAlign: 'center', bgcolor: 'background.default', p: 2, borderRadius: 2 }}>
            <Box>
                <Typography variant="caption" color="text.secondary">本日の累計</Typography>
                <Typography variant="h6" fontWeight="bold">{formatBytes(todayUsage)}</Typography>
            </Box>
        </Box>

        <Box sx={{ width: '100%', height: 320 }}>
            <Chart 
                options={chartOptions} 
                series={[{ name: '通信量', data: chartData }]} 
                type="area" 
                height="100%" 
                width="100%"
            />
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center', fontSize: '0.7rem' }}>
            ※ ピンチ操作で拡大・縮小、スワイプでスクロールできます。<br/>
            5分毎の通信量を集計しています。
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
