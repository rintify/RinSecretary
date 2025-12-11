'use client'; 

// Clean imports
import { useState, useRef } from 'react';
// TimeTable is used inside Carousel? No, Carousel is imported. TimeTable is NOT used in page.tsx.
import { Event as EventIcon, TaskAlt as TaskIcon } from '@mui/icons-material';
// Removed: AddIcon, CalendarIcon, LogoutIcon, ArrowBackIosNew, ArrowForwardIos, EditIcon
import { logout } from '@/lib/actions';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import TaskForm from './components/TaskForm';
import EventForm from './components/EventForm';
import TaskDetailModal from './components/TaskDetailModal';
import EventDetailModal from './components/EventDetailModal';
import AlarmForm from './components/AlarmForm';
import AlarmDetailModal from './components/AlarmDetailModal';
import SettingsModal from './components/SettingsModal';
import FreeTimeModal from './components/FreeTimeModal';
import { Suspense } from 'react';
import { IconButton, Box, Fab, Dialog, DialogContent, useTheme, useMediaQuery, Tooltip, Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Settings as SettingsIcon, Notifications as AlarmIcon, Menu as MenuIcon, AccessTime as AccessTimeIcon } from '@mui/icons-material';
import TimeTableSwiper from './components/TimeTableSwiper';

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
      }
  };
  
  // Removed handlePrevDay, handleNextDay

  // Modal State
  const [activeModal, setActiveModal] = useState<'NONE' | 'NEW_TASK' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT' | 'DETAIL_TASK' | 'DETAIL_EVENT' | 'NEW_ALARM' | 'EDIT_ALARM' | 'DETAIL_ALARM' | 'SETTINGS' | 'FREE_TIME'>('NONE');
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

  const handleCloseModal = () => {
      setActiveModal('NONE');
      setModalData(null);
      setRefreshTrigger(prev => prev + 1);
  };
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Custom Header */}
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
                  onClick={() => dateInputRef.current?.showPicker()}
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
              <input 
                type="date" 
                ref={dateInputRef}
                style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}
                onChange={handleDateChange} 
              />
          </Box>

          {/* Right: Menu */}
          <Box>
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
                  <MenuItem onClick={() => { handleMenuClose(); setActiveModal('SETTINGS'); }}>
                      <ListItemIcon>
                          <SettingsIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>設定</ListItemText>
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
                <Fab color="primary" aria-label="add task" onClick={handleNewTask} size="medium">
                    <TaskIcon />
                </Fab>
             </Tooltip>
             <Tooltip title="New Event" placement="left">
                <Fab color="primary" aria-label="add event" onClick={() => handleNewEvent()} size="medium" sx={{ bgcolor: 'secondary.main' }}>
                    <EventIcon />
                </Fab>
             </Tooltip>
             <Tooltip title="New Alarm" placement="left">
                <Fab color="primary" aria-label="add alarm" onClick={handleNewAlarm} size="medium" sx={{ bgcolor: '#FF4500' }}>
                    <AlarmIcon />
                </Fab>
             </Tooltip>
          </Box>
      </Box>


      
      {/* Dialog */}
      <Dialog
        open={activeModal !== 'NONE'}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
             <Suspense fallback={<Box p={4}>Loading...</Box>}>
                {activeModal === 'NEW_TASK' && (
                    <TaskForm 
                        onSuccess={handleCloseModal} 
                        isModal
                        initialDate={currentDate}
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
                        initialDate={currentDate}
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
                        initialDate={currentDate}
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
                {activeModal === 'FREE_TIME' && (
                    <FreeTimeModal
                        onClose={handleCloseModal}
                    />
                )}
            </Suspense>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
