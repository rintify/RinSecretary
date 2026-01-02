'use client'; 

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Event as EventIcon, TaskAlt as TaskIcon, Note as MemoIcon } from '@mui/icons-material';
import { format, isSameDay, subDays, addDays, differenceInMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useRef } from 'react';
import TaskForm from './components/TaskForm';
import EventForm from './components/EventForm';
import TaskDetailModal from './components/TaskDetailModal';
import EventDetailModal from './components/EventDetailModal';
import AlarmForm from './components/AlarmForm';
import AlarmDetailModal from './components/AlarmDetailModal';
import SettingsModal from './components/SettingsModal';
import RegularTaskSettingsModal from './components/RegularTaskSettingsModal';
import FreeTimeModal from './components/FreeTimeModal';
import ExpiredTaskListModal from './components/ExpiredTaskListModal';
import { getExpiredTaskCount } from '@/lib/task-actions';
import { fetchGoogleEvents } from '@/lib/calendar-actions';
import { getAlarms } from '@/lib/alarm-actions';
import { TaskLocal } from './components/TimeTable';
import { Suspense, useEffect } from 'react';
import { 
    IconButton, Box, Fab, Dialog, DialogContent, DialogTitle, DialogActions, Typography,
    useTheme, useMediaQuery, Tooltip, Button, 
    Menu, MenuItem, ListItemIcon, ListItemText, 
    CircularProgress, Divider, Badge 
} from '@mui/material';
import { 
    Menu as MenuIcon, 
    Add as AddIcon, 
    ChevronLeft, 
    ChevronRight, 
    MyLocation as MyLocationIcon,
    AccessTime as AccessTimeIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon,
    Notifications as AlarmIcon,
    DataUsage as DataUsageIcon
} from '@mui/icons-material';
import TimeTableSwiper from './components/TimeTableSwiper';
import CustomDatePicker from './components/ui/CustomDatePicker';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppRegistration as BulkIcon } from '@mui/icons-material';
import BulkEventCreator from './components/BulkEventCreator';
import ImmediateTaskFlow from './components/immediate/ImmediateTaskFlow';
import ImmediateEventFlow from './components/immediate/ImmediateEventFlow';
import ImmediateAlarmFlow from './components/immediate/ImmediateAlarmFlow';
import LongPressFab from './components/ui/LongPressFab';
import DataUsageModal from './components/DataUsageModal';

import { EVENT_COLOR, TASK_COLOR, ALARM_COLOR, MEMO_COLOR } from './utils/colors';

// Helper to get the "Business Date" (shifts day back if before 4 AM)
const getBusinessDate = () => {
    const now = new Date();
    if (now.getHours() < 4) {
        return subDays(now, 1);
    }
    return now;
};

export default function Home() {
  const [currentDate, setCurrentDate] = useState(getBusinessDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Modal State
  // Modal State
  const [activeModal, setActiveModal] = useState<'NONE' | 'NEW_TASK' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT' | 'DETAIL_TASK' | 'DETAIL_EVENT' | 'NEW_ALARM' | 'EDIT_ALARM' | 'DETAIL_ALARM' | 'SETTINGS' | 'FREE_TIME' | 'BULK_CREATE' | 'IMMEDIATE_TASK' | 'IMMEDIATE_EVENT' | 'IMMEDIATE_ALARM' | 'REGULAR_TASK_SETTINGS' | 'DATA_USAGE' | 'EXPIRED_TASKS'>('NONE');
  const [modalData, setModalData] = useState<any>(null); // { startTime } or { id }

  const handleNewTask = () => {
      setModalData(null);
      setActiveModal('NEW_TASK');
  };

  const handleNewEvent = (startTime?: string) => {
    setModalData({ startTime });
    setActiveModal('NEW_EVENT');
  };

  const handleNewAlarm = () => {
      setModalData(null);
      setActiveModal('NEW_ALARM');
  };

  const handleTaskClick = (task: any) => {
      setModalData(task);
      if (task.deadline) {
        setActiveModal('DETAIL_TASK');
      } else if (task.type === 'ALARM') {
        setActiveModal('DETAIL_ALARM');
      } else {
        setActiveModal('DETAIL_EVENT');
      }
  };

  const handleEditFromDetail = () => {
      // modalData is the task
      if (modalData?.deadline) {
          setActiveModal('EDIT_TASK');
      } else if (modalData?.type === 'ALARM') {
          setActiveModal('EDIT_ALARM');
      } else {
          setActiveModal('EDIT_EVENT');
      }
  };

  const handleCloseModal = (arg?: any) => {
      const closingModal = activeModal;
      setActiveModal('NONE');
      setModalData(null);
      
      // Update logic: Only refresh what's needed
      const isCalendar = closingModal.includes('EVENT') || closingModal.includes('ALARM') || closingModal === 'SETTINGS' || closingModal === 'FREE_TIME';
      const isTask = closingModal.includes('TASK') || closingModal === 'BULK_CREATE' || closingModal === 'SETTINGS' || closingModal === 'FREE_TIME' || closingModal === 'EXPIRED_TASKS' || closingModal === 'REGULAR_TASK_SETTINGS';

      if (isCalendar) {
          setCalendarRefreshTrigger(prev => prev + 1);
      }
      if (isTask) {
          setTaskRefreshTrigger(prev => prev + 1);
      }

      if (arg instanceof Date) {
          // Convert the item's date to its corresponding business date
          // If the time is before 4 AM, it belongs to the previous calendar day's business day
          const itemDate = arg;
          const businessDate = itemDate.getHours() < 4 ? subDays(itemDate, 1) : itemDate;
          setCurrentDate(businessDate);
      }
  };
  
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  const [memoLoading, setMemoLoading] = useState(false);
  const router = useRouter();

  const handleCreateMemo = async () => {
    if (memoLoading) return;
    setMemoLoading(true);
    try {
        const { createEmptyMemo } = await import('./memos/actions');
        const memo = await createEmptyMemo();
        router.push(`/memos/${memo.id}/edit?new=true`);
    } catch (e) {
        console.error(e);
        setMemoLoading(false);
        alert('メモ作成に失敗しました');
    }
  };

  // Expired Tasks Badge
  const [expiredCount, setExpiredCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchCount = async () => {
        const count = await getExpiredTaskCount();
        setExpiredCount(count);
    };
    fetchCount();

    // Re-fetch on refreshTrigger (e.g. when modal closes)
    if (activeModal === 'NONE') {
        fetchCount();
    }
  }, [taskRefreshTrigger, activeModal]);

  // Google Events & Alarms Sync
  const [googleEvents, setGoogleEvents] = useState<TaskLocal[]>([]);
  const [tasks, setTasks] = useState<TaskLocal[]>([]); // Synched Local Tasks
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());

  // Client-side caching for Calendar
  const [calendarCacheRange, setCalendarCacheRange] = useState<{ start: Date; end: Date } | null>(null);
  const prevTriggerRef = useRef(calendarRefreshTrigger);
  const FETCH_WINDOW_DAYS = 7;
  const BUFFER_DAYS = 2;

  const loadEvents = async () => {
      // Check cache validity
      const isForce = calendarRefreshTrigger !== prevTriggerRef.current;
      prevTriggerRef.current = calendarRefreshTrigger;

      const inRange = calendarCacheRange && 
          currentDate > addDays(calendarCacheRange.start, BUFFER_DAYS) && 
          currentDate < subDays(calendarCacheRange.end, BUFFER_DAYS);

      // If legitimate cache hit and not force refresh, skip
      if (!isForce && inRange && googleEvents.length > 0) {
          // console.log("Cache Hit: Skipping fetch");
          // Update lastSyncedAt just to show it's "live" enough? Or maybe kept as is?
          // Let's keep lastSyncedAt as the actual API fetch time to be honest.
          return;
      }

      setIsSyncing(true);
      // Fetch wider window
      const start = subDays(currentDate, FETCH_WINDOW_DAYS);
      const end = addDays(currentDate, FETCH_WINDOW_DAYS);
      
      try {
          const eventsPromise = fetchGoogleEvents(start, end);
          const alarmsPromise = getAlarms(start, end);

          const [events, alarms] = await Promise.all([eventsPromise, alarmsPromise]);
          setGoogleEvents([...(events as TaskLocal[]), ...(alarms as TaskLocal[])]);
          setLastSyncedAt(new Date());
          setSyncError(false);
          setCalendarCacheRange({ start, end });
      } catch (e: any) {
          // AUTH_ERROR is expected when token is expired/revoked, so we don't log it as error
          if (e?.message !== 'AUTH_ERROR' && !e?.message?.includes('AUTH_ERROR')) {
            console.error("Failed to load events/alarms", e);
          }
          setSyncError(true);
      } finally {
          setIsSyncing(false);
      }
  };

  const fetchTasks = async () => {
      try {
          const res = await fetch('/api/tasks');
          if (res.ok) {
              const data = await res.json();
              setTasks(data);
          }
      } catch (e) { console.error("Failed to fetch tasks", e); }
  };

  useEffect(() => {
      loadEvents();
  }, [currentDate, calendarRefreshTrigger]);

  useEffect(() => {
    fetchTasks();
  }, [currentDate, taskRefreshTrigger]);

  // Update 'now' for sync status calculation
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Every minute
    return () => clearInterval(timer);
  }, []);

  const timeSinceSync = lastSyncedAt ? differenceInMinutes(now, lastSyncedAt) : 999;
  const isSyncedRecently = !syncError && timeSinceSync < 5;



  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const theme = useTheme();
  // Unused fullScreen var can be removed or kept? kept for safety if used later in unseen code? 
  // Step 12 showed it used but I need to check where.
  // Actually looking at Step 12, fullScreen is only declared, not used in JSX shown? 
  // Wait, I see `maxWidth="sm" fullWidth` in Dialog. 
  // Ah, let's keep it.
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Custom Header */}
      <Box sx={{ 
          height: '60px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          px: 2, 
          borderBottom: 1, 
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0,
          zIndex: 1200, // Elevated z-index
          position: 'fixed', // Fixed position
          top: 0,
          left: 0,
          right: 0
      }}>
          
          {/* Main Navigation Group: Date Left Aligned */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
              <Button 
                  onClick={() => setShowDatePicker(true)}
                  sx={{ 
                      color: 'text.primary',
                      textTransform: 'none',
                      fontSize: '1.4rem', 
                      fontWeight: 'bold',
                      minWidth: 'auto',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                      pl: 0, // Remove left padding to align to edge
                      justifyContent: 'flex-start'
                  }}
              >
                  {format(currentDate, 'MM/dd (E)', { locale: ja })}
              </Button>
              <CustomDatePicker 
                  open={showDatePicker}
                  onClose={() => setShowDatePicker(false)}
                  value={currentDate}
                  onChange={setCurrentDate}
              />
              
              <Tooltip title={isSyncing ? "同期中..." : (syncError ? "認証エラー：再ログインしてください" : `最終同期: ${lastSyncedAt ? format(lastSyncedAt, 'HH:mm') : '未同期'}`)}>
                  <Box 
                      onClick={() => setShowSyncModal(true)}
                      sx={{ 
                          ml: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          height: 24, 
                          width: 24, 
                          justifyContent: 'center',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.8 }
                      }}
                  >
                      <AnimatePresence mode="wait">
                          {isSyncing ? (
                              <motion.div
                                  key="syncing"
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.5 }}
                                  transition={{ duration: 0.2 }}
                              >
                                  <CircularProgress size={12} thickness={5} color="inherit" sx={{ opacity: 0.6, display: 'block' }} />
                              </motion.div>
                          ) : (
                              <motion.div
                                  key="status-dot"
                                  initial={{ scale: 0.8 }}
                                  animate={{ 
                                      scale: 1,
                                      backgroundColor: syncError ? '#f44336' : (isSyncedRecently ? '#4caf50' : '#ff9800')
                                  }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                  style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                  }}
                              />
                          )}
                      </AnimatePresence>
                  </Box>
              </Tooltip>
          </Box>

          {/* Right: Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
               <IconButton onClick={() => setCurrentDate(getBusinessDate())} size="small" sx={{ mr: 0, color: 'text.secondary' }}>
                  <MyLocationIcon />
              </IconButton>
              <IconButton onClick={handleMenuOpen}>
                  <MenuIcon />
              </IconButton>
              <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
              >
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('EXPIRED_TASKS'); }}>
                      <ListItemIcon>
                          <WarningIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText sx={{ color: 'error.main' }}>期限切れタスク</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('FREE_TIME'); }}>
                      <ListItemIcon>
                          <AccessTimeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>空き時間</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('BULK_CREATE'); }}>
                      <ListItemIcon>
                          <BulkIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>一括作成</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('SETTINGS'); }}>
                      <ListItemIcon>
                          <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>設定</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('REGULAR_TASK_SETTINGS'); }}>
                      <ListItemIcon>
                           <TaskIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>定期タスク設定</ListItemText>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('DATA_USAGE'); }}>
                       <ListItemIcon>
                           <DataUsageIcon fontSize="small" />
                       </ListItemIcon>
                       <ListItemText>通信量</ListItemText>
                   </MenuItem>
                  <MenuItem onClick={async () => { 
                      handleMenuClose(); 
                      const { logout } = await import('@/lib/actions');
                      await logout();
                  }}>
                      <ListItemIcon>
                           <Box sx={{ color: 'error.main', display: 'flex' }}>
                               <SettingsIcon fontSize="small" sx={{ opacity: 0 }} /> {/* Spacer */}
                               {/* Or import Logout icon? Let's keep it simple or allow standard text */}
                           </Box>
                      </ListItemIcon>
                      <ListItemText primaryTypographyProps={{ color: 'error' }}>ログアウト</ListItemText>
                  </MenuItem>
              </Menu>
          </Box>
      </Box>
      
      {/* Main Display with Swiper */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', mt: '60px', height: 'calc(100dvh - 60px)' }}>
          <TimeTableSwiper 
              currentDate={currentDate} 
              onDateChange={setCurrentDate}
              onNewTask={(time) => handleNewEvent(time)} 
              onEditTask={handleTaskClick}
              refreshTrigger={taskRefreshTrigger}
              expiredCount={expiredCount}
              onOpenExpired={() => setActiveModal('EXPIRED_TASKS')}
              googleEvents={googleEvents}
              tasks={tasks}
          />
          
          {/* FABs */}
          <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', zIndex: 100 }}>
             <Tooltip title="New Task" placement="left">
                <Box>
                <LongPressFab 
                    aria-label="add task" 
                    onClick={() => { setModalData(null); setActiveModal('IMMEDIATE_TASK'); }}
                    onLongPress={handleNewTask}
                    size="medium"
                    sx={{ bgcolor: TASK_COLOR, color: '#fff', '&:hover': { bgcolor: TASK_COLOR, opacity: 0.9 } }}
                >
                    <TaskIcon />
                </LongPressFab>
                </Box>
             </Tooltip>
             <Tooltip title="New Event" placement="left">
                <Box>
                <LongPressFab 
                    aria-label="add event" 
                    onClick={() => { setModalData({ startTime: undefined }); setActiveModal('IMMEDIATE_EVENT'); }}
                    onLongPress={() => handleNewEvent()} 
                    size="medium" 
                    sx={{ bgcolor: EVENT_COLOR, color: '#fff', '&:hover': { bgcolor: EVENT_COLOR, opacity: 0.9 } }}
                >
                    <EventIcon />
                </LongPressFab>
                </Box>
             </Tooltip>
             <Tooltip title="New Alarm" placement="left">
                <Box>
                <LongPressFab 
                    aria-label="add alarm" 
                    onClick={() => { setModalData(null); setActiveModal('IMMEDIATE_ALARM'); }}
                    onLongPress={handleNewAlarm}
                    size="medium" 
                    sx={{ bgcolor: ALARM_COLOR, color: '#fff', '&:hover': { bgcolor: ALARM_COLOR, opacity: 0.9 } }}
                >
                    <AlarmIcon />
                </LongPressFab>
                </Box>
             </Tooltip>
             <Tooltip title="New Memo" placement="left">
                <Box>
                <Fab 
                    aria-label="view memos" 
                    component={Link}
                    href="/memos"
                    size="medium" 
                    sx={{ bgcolor: MEMO_COLOR, color: '#fff', '&:hover': { bgcolor: MEMO_COLOR, opacity: 0.9 } }}
                >
                    <MemoIcon />
                </Fab>
                </Box>
             </Tooltip>
          </Box>
      </Box>

      {/* Dialog */}
      <Dialog
        open={activeModal !== 'NONE' && !activeModal.startsWith('IMMEDIATE') && activeModal !== 'BULK_CREATE'}
        onClose={handleCloseModal}
        maxWidth={false}
        PaperProps={{
            sx: {
                width: '92%', // 4% margin x 2
                maxWidth: '600px', // Reasonable max-width for desktop
                m: 'auto',
                borderRadius: 3
            }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
             <Suspense fallback={<Box p={4}>Loading...</Box>}>
                {activeModal === 'NEW_TASK' && (
                    <TaskForm 
                        onSuccess={handleCloseModal} 
                        isModal
                        initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                    />
                )}
                 {activeModal === 'EDIT_TASK' && (
                    <TaskForm 
                        taskId={modalData?.id} 
                        initialValues={modalData}
                        onSuccess={handleCloseModal} 
                        isModal
                    />
                )}
                {activeModal === 'NEW_EVENT' && (
                     <EventForm
                        initialStartTime={modalData?.startTime}
                        onSuccess={handleCloseModal}
                        isModal
                        initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                     />
                )}
                {activeModal === 'EDIT_EVENT' && (
                    <EventForm 
                        eventId={modalData?.id}
                        initialValues={modalData}
                        onSuccess={handleCloseModal} 
                        isModal
                    />
                )}
                {activeModal === 'DETAIL_TASK' && (
                    <TaskDetailModal
                        task={modalData}
                        onClose={handleCloseModal}
                        onEdit={handleEditFromDetail}
                        onUpdate={() => setTaskRefreshTrigger(prev => prev + 1)}
                    />
                )}
                {activeModal === 'DETAIL_EVENT' && (
                    <EventDetailModal
                        event={modalData}
                        onClose={handleCloseModal}
                        onEdit={handleEditFromDetail}
                    />
                )}
                {activeModal === 'NEW_ALARM' && (
                    <AlarmForm
                        onSuccess={handleCloseModal}
                        isModal
                        initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
                    />
                )}
                {activeModal === 'EDIT_ALARM' && (
                    <AlarmForm
                        alarmId={modalData?.id}
                        initialValues={modalData}
                        onSuccess={handleCloseModal}
                        isModal
                    />
                )}
                {activeModal === 'DETAIL_ALARM' && (
                    <AlarmDetailModal
                        alarm={modalData}
                        onClose={handleCloseModal}
                        onEdit={handleEditFromDetail}
                    />
                )}
                {activeModal === 'SETTINGS' && (
                    <SettingsModal
                        onClose={handleCloseModal}
                    />
                )}
                {activeModal === 'REGULAR_TASK_SETTINGS' && (
                    <RegularTaskSettingsModal
                        onClose={handleCloseModal}
                    />
                )}
                {activeModal === 'FREE_TIME' && (
                    <FreeTimeModal
                        onClose={handleCloseModal}
                    />
                )}
                {activeModal === 'DATA_USAGE' && (
                    <DataUsageModal
                        open={true}
                        onClose={handleCloseModal}
                    />
                )}
                {activeModal === 'EXPIRED_TASKS' && (
                    <ExpiredTaskListModal
                        open={true}
                        onClose={handleCloseModal}
                        onEditTask={handleTaskClick} 
                    />
                )}
            </Suspense>
        </DialogContent>
      </Dialog>

    {/* Immediate Action Flows */}
    {activeModal === 'IMMEDIATE_TASK' && (
        <ImmediateTaskFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
        />
    )}
    {activeModal === 'IMMEDIATE_EVENT' && (
        <ImmediateEventFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
        />
    )}
    {activeModal === 'IMMEDIATE_ALARM' && (
        <ImmediateAlarmFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, getBusinessDate()) ? new Date() : currentDate}
        />
    )}

    {/* Bulk Creator */}
    {activeModal === 'BULK_CREATE' && (
        <BulkEventCreator 
            onBack={handleCloseModal}
            onSuccess={() => { handleCloseModal(); setTaskRefreshTrigger(prev => prev + 1); }}
            startWeekDate={currentDate}
        />
    )}

    {/* Sync Status Dialog */}
    <Dialog open={showSyncModal} onClose={() => setShowSyncModal(false)}>
        <DialogTitle>同期ステータス</DialogTitle>
        <DialogContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: syncError ? '#f44336' : (isSyncedRecently ? '#4caf50' : '#ff9800'),
                    mr: 1
                }} />
                <Typography variant="body1">
                    {syncError ? "認証エラー" : (isSyncedRecently ? "最新 (同期済み)" : "未同期 (時間経過)")}
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
                最終同期: {lastSyncedAt ? format(lastSyncedAt, 'yyyy/MM/dd HH:mm:ss') : '未同期'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {syncError ? "Googleアカウントの認証が切れています。再ログインしてください。" : "通常は自動で同期されますが、ボタンを押して手動で更新することもできます。"}
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setShowSyncModal(false)}>閉じる</Button>
            <Button variant="contained" onClick={() => {
                setTaskRefreshTrigger(prev => prev + 1);
                setCalendarRefreshTrigger(prev => prev + 1);
                setShowSyncModal(false);
            }}>
                最新にする
            </Button>
        </DialogActions>
    </Dialog>

    </Box>
  );
}
