'use client'; 

import { useState, useRef } from 'react';
import TimeTable from './components/TimeTable';
import ChatInterface from './components/ChatInterface';
import { Add as AddIcon, Chat as ChatIcon, CalendarMonth as CalendarIcon, Logout as LogoutIcon, ArrowBackIosNew, ArrowForwardIos, Edit as EditIcon, Event as EventIcon, TaskAlt as TaskIcon } from '@mui/icons-material';
import { logout } from '@/lib/actions';
import { format, addDays, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import TaskForm from './components/TaskForm';
import EventForm from './components/EventForm';
import { Suspense } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Fab, Dialog, DialogContent, useTheme, useMediaQuery, Stack, Tooltip } from '@mui/material';

export default function Home() {
  const [showChat, setShowChat] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          setCurrentDate(new Date(e.target.value));
      }
  };
  
  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  // Modal State
  const [activeModal, setActiveModal] = useState<'NONE' | 'NEW_TASK' | 'NEW_EVENT' | 'EDIT_TASK' | 'EDIT_EVENT'>('NONE');
  const [modalData, setModalData] = useState<any>(null); // { startTime } or { id }

  const handleNewTask = () => {
      setModalData(null);
      setActiveModal('NEW_TASK');
  };

  const handleNewEvent = (startTime?: string) => {
    setModalData({ startTime });
    setActiveModal('NEW_EVENT');
  };

  const handleEditTask = (task: any) => {
      setModalData({ id: task.id, initialValues: task });
      // Identify type from props or task object
      if (task.deadline) {
        setActiveModal('EDIT_TASK');
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
  
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={handlePrevDay} edge="start">
                    <ArrowBackIosNew />
                </IconButton>
                
                <Typography variant="h6" sx={{ fontWeight: 'bold', minWidth: 120, textAlign: 'center', mx: 2 }}>
                    {format(currentDate, 'MM/dd (E)', { locale: ja })}
                </Typography>
                
                <input 
                  type="date" 
                  ref={dateInputRef}
                  style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0 }}
                  onChange={handleDateChange} 
                />
                <IconButton onClick={() => dateInputRef.current?.showPicker()}>
                    <CalendarIcon />
                </IconButton>
                
                <IconButton onClick={() => logout()}>
                    <LogoutIcon />
                </IconButton>

                <IconButton onClick={handleNextDay}>
                    <ArrowForwardIos />
                </IconButton>
            </Box>
        </Toolbar>
      </AppBar>
      <Toolbar /> {/* Spacer */}
      
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TimeTable 
              date={currentDate} 
              onNewTask={(time) => handleNewEvent(time)} // Clicking on timetable creates EVENT usually
              onEditTask={handleEditTask}
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
             <Fab color="secondary" aria-label="chat" onClick={() => setShowChat(!showChat)} size="medium" sx={{ bgcolor: 'info.main' }}>
                <ChatIcon />
             </Fab>
          </Box>
      </Box>

      {/* Chat Drawer / Overlay */}
      {showChat && (
          <Box 
            sx={{ 
                position: 'fixed', 
                top: 0, left: 0, right: 0, bottom: 0, 
                zIndex: theme.zIndex.drawer, 
                bgcolor: 'background.paper' 
            }}
          >
             <ChatInterface onClose={() => setShowChat(false)} />
          </Box>
      )}
      
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
                    />
                )}
                {activeModal === 'EDIT_TASK' && (
                    <TaskForm 
                        taskId={modalData?.id} 
                        initialValues={modalData?.initialValues}
                        onSuccess={handleCloseModal} 
                        isModal
                    />
                )}
                {activeModal === 'NEW_EVENT' && (
                     <EventForm
                        initialStartTime={modalData?.startTime}
                        onSuccess={handleCloseModal}
                        isModal
                     />
                )}
                {activeModal === 'EDIT_EVENT' && (
                    <EventForm 
                        eventId={modalData?.id}
                        initialValues={modalData?.initialValues}
                        onSuccess={handleCloseModal} 
                        isModal
                    />
                )}
            </Suspense>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
