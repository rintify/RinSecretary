'use client'; 

import { useState } from 'react';
import { Event as EventIcon, TaskAlt as TaskIcon, Note as MemoIcon } from '@mui/icons-material';
import { format, isSameDay, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import TaskForm from './components/TaskForm';
import EventForm from './components/EventForm';
import TaskDetailModal from './components/TaskDetailModal';
import EventDetailModal from './components/EventDetailModal';
import AlarmForm from './components/AlarmForm';
import AlarmDetailModal from './components/AlarmDetailModal';
import SettingsModal from './components/SettingsModal';
import RegularTaskSettingsModal from './components/RegularTaskSettingsModal';
import FreeTimeModal from './components/FreeTimeModal';
import { Suspense } from 'react';
import { IconButton, Box, Fab, Dialog, DialogContent, useTheme, useMediaQuery, Tooltip, Button, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import { Settings as SettingsIcon, Notifications as AlarmIcon, Menu as MenuIcon, AccessTime as AccessTimeIcon, MyLocation as MyLocationIcon } from '@mui/icons-material';
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

import { EVENT_COLOR, TASK_COLOR, ALARM_COLOR, MEMO_COLOR } from './utils/colors';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal State
  // Modal State
  const [activeModal, setActiveModal] = useState<'NONE' | 'NEW_TASK' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT' | 'DETAIL_TASK' | 'DETAIL_EVENT' | 'NEW_ALARM' | 'EDIT_ALARM' | 'DETAIL_ALARM' | 'SETTINGS' | 'FREE_TIME' | 'BULK_CREATE' | 'IMMEDIATE_TASK' | 'IMMEDIATE_EVENT' | 'IMMEDIATE_ALARM' | 'REGULAR_TASK_SETTINGS'>('NONE');
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
      setActiveModal('NONE');
      setModalData(null);
      setRefreshTrigger(prev => prev + 1);
      if (arg instanceof Date) {
          setCurrentDate(arg);
      }
  };
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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
          zIndex: 10
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
              <IconButton onClick={() => setCurrentDate(new Date())} size="small" sx={{ ml: 1, color: 'text.secondary' }}>
                  <MyLocationIcon />
              </IconButton>
              <CustomDatePicker 
                  open={showDatePicker}
                  onClose={() => setShowDatePicker(false)}
                  value={currentDate}
                  onChange={setCurrentDate}
              />
          </Box>

          {/* Right: Menu */}
          <Box>
              <IconButton component={Link} href="/memos">
                  <MemoIcon />
              </IconButton>
              <IconButton onClick={handleMenuOpen}>
                  <MenuIcon />
              </IconButton>
              <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
              >
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
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TimeTableSwiper 
              currentDate={currentDate} 
              onDateChange={setCurrentDate}
              onNewTask={(time) => handleNewEvent(time)} 
              onEditTask={handleTaskClick}
              refreshTrigger={refreshTrigger}
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
                    aria-label="add memo" 
                    onClick={handleCreateMemo}
                    disabled={memoLoading}
                    size="medium" 
                    sx={{ bgcolor: MEMO_COLOR, color: '#fff', '&:hover': { bgcolor: MEMO_COLOR, opacity: 0.9 } }}
                >
                    {memoLoading ? <CircularProgress size={24} color="inherit" /> : <MemoIcon />}
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
                        initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
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
                        initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
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
                        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
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
                        initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
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
            </Suspense>
        </DialogContent>
      </Dialog>

    {/* Immediate Action Flows */}
    {activeModal === 'IMMEDIATE_TASK' && (
        <ImmediateTaskFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
        />
    )}
    {activeModal === 'IMMEDIATE_EVENT' && (
        <ImmediateEventFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
        />
    )}
    {activeModal === 'IMMEDIATE_ALARM' && (
        <ImmediateAlarmFlow
            onClose={handleCloseModal}
            onSuccess={handleCloseModal}
            initialDate={isSameDay(currentDate, new Date()) ? new Date() : currentDate}
        />
    )}

    {/* Bulk Creator */}
    {activeModal === 'BULK_CREATE' && (
        <BulkEventCreator 
            onBack={handleCloseModal}
            onSuccess={() => { handleCloseModal(); setRefreshTrigger(prev => prev + 1); }}
            startWeekDate={currentDate}
        />
    )}

    </Box>
  );
}
