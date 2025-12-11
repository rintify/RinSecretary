
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Box, Button, Typography, IconButton, TextField
} from '@mui/material';
import { 
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, addDays, startOfDay, addMinutes, setHours, setMinutes, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Dialog, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React, {  // Add React here
  forwardRef
} from 'react';
import { createGoogleEvent, fetchGoogleEvents } from '@/lib/calendar-actions';
import { getPalette, updatePalette } from '@/app/actions/palette';

interface BulkEventCreatorProps {
  onBack: () => void;
  onSuccess: () => void;
  startWeekDate?: Date;
}

const HOURS_START = 4;
const HOURS_END = 28; // 4:00 next day
const TOTAL_MINUTES = (HOURS_END - HOURS_START) * 60;
const SLOTS_5_MIN = TOTAL_MINUTES / 5; // 288 slots

// Transition for full screen dialog
const Transition = forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const COLORS = [
  { key: 'transparent', hex: 'transparent', label: 'None', contrast: '#000' }, // Eraser
  { key: 'black', hex: '#000000', label: 'Custom', contrast: '#fff' },
  { key: 'red', hex: '#f44336', label: 'Red', contrast: '#fff' },
  { key: 'blue', hex: '#2196f3', label: 'Blue', contrast: '#fff' },
  { key: 'yellow', hex: '#ffeb3b', label: 'Yellow', contrast: '#000' },
  { key: 'green', hex: '#4caf50', label: 'Green', contrast: '#fff' },
  { key: 'purple', hex: '#9c27b0', label: 'Purple', contrast: '#fff' },
];

// Default Palette to ensure modal works even if fetch fails
// Default Titles
const DEFAULT_TITLES: Record<string, string> = {
    black: 'Work',
    red: 'Important',
    blue: 'Personal',
    yellow: 'Lunch',
    green: 'Exercise',
    purple: 'Study'
};

export default function BulkEventCreator({ onBack, onSuccess, startWeekDate: initialStartWeekDate = new Date() }: BulkEventCreatorProps) {
  const [startWeekDate, setStartWeekDate] = useState(initialStartWeekDate);
  const [granularity, setGranularity] = useState(30); // 5, 10, 15, 30
  const [selectedColor, setSelectedColor] = useState('black');
  const [colorTitles, setColorTitles] = useState<Record<string, string>>(DEFAULT_TITLES);
  
  // Persistence: Key = 'yyyy-MM-dd', Value = Array(288) of color keys
  const [paintedData, setPaintedData] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Existing events slots: Key = 'yyyy-MM-dd', Value = Map of slot index to event count
  const [existingEventsSlots, setExistingEventsSlots] = useState<Record<string, Map<number, number>>>({});

  // Fetch Palette on Mount
  useEffect(() => {
      const loadPalette = async () => {
          const p = await getPalette(); // returns array
          if (Array.isArray(p)) {
              // Convert array to Record
              const textMap: Record<string, string> = { ...DEFAULT_TITLES };
              
              // Apply DB values
              p.forEach((item: any) => {
                  if (item.key && item.title) {
                      textMap[item.key] = item.title;
                  }
              });

              // FORCE RESET BLACK
              textMap['black'] = '';

              setColorTitles(textMap);
          }
      };
      loadPalette();
  }, []);

  const days = useMemo(() => {
    const d = [];
    const start = startOfDay(startWeekDate);
    for (let i = 0; i < 7; i++) {
      d.push(addDays(start, i));
    }
    return d;
  }, [startWeekDate]);

  // Fetch existing Google Calendar events for the week
  useEffect(() => {
    const loadExistingEvents = async () => {
      const weekStart = startOfDay(startWeekDate);
      const weekEnd = addDays(weekStart, 7);
      
      try {
        const events = await fetchGoogleEvents(weekStart, weekEnd);
        const slotsMap: Record<string, Map<number, number>> = {};
        
        events.forEach((event: any) => {
          if (!event.startTime || !event.endTime) return;
          
          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          
          // Process each day the event spans
          let currentDay = startOfDay(start);
          while (currentDay < end) {
            const dayKey = format(currentDay, 'yyyy-MM-dd');
            if (!slotsMap[dayKey]) slotsMap[dayKey] = new Map();
            
            // Calculate slot indices for this day
            // Base time: 4:00 AM of this day
            const baseTime = new Date(currentDay);
            baseTime.setHours(HOURS_START, 0, 0, 0);
            
            // Start slot: floor(minutes from base / 5)
            let startMinutes = Math.max(0, (start.getTime() - baseTime.getTime()) / 60000);
            let startSlot = Math.floor(startMinutes / 5); // 切り下げ
            
            // End slot: ceil(minutes from base / 5)
            const nextDay = addDays(currentDay, 1);
            const effectiveEnd = end < nextDay ? end : nextDay;
            let endMinutes = (effectiveEnd.getTime() - baseTime.getTime()) / 60000;
            let endSlot = Math.ceil(endMinutes / 5); // 切り上げ
            
            // Clamp to valid range [0, SLOTS_5_MIN)
            startSlot = Math.max(0, Math.min(startSlot, SLOTS_5_MIN - 1));
            endSlot = Math.max(0, Math.min(endSlot, SLOTS_5_MIN));
            
            for (let i = startSlot; i < endSlot; i++) {
              slotsMap[dayKey].set(i, (slotsMap[dayKey].get(i) || 0) + 1);
            }
            
            currentDay = nextDay;
          }
        });
        
        setExistingEventsSlots(slotsMap);
      } catch (e) {
        console.error('Failed to load existing events:', e);
      }
    };
    
    loadExistingEvents();
  }, [startWeekDate]);

  const handleSlotClick = (dayIndex: number, slotIndex: number) => {
    // Fill based on granularity
    const slotsPerStep = granularity / 5;
    const blockStart = Math.floor(slotIndex / slotsPerStep) * slotsPerStep;
    
    const dayDate = days[dayIndex];
    if (!dayDate) return;
    const dayKey = format(dayDate, 'yyyy-MM-dd');

    setPaintedData(prev => {
        const currentSlots = prev[dayKey] ? [...prev[dayKey]] : Array(SLOTS_5_MIN).fill('transparent');
        
        for (let i = 0; i < slotsPerStep; i++) {
            if (blockStart + i < SLOTS_5_MIN) {
                currentSlots[blockStart + i] = selectedColor;
            }
        }
        
        return {
            ...prev,
            [dayKey]: currentSlots
        };
    });
  };

  // Support Drag Painting?
  const [isDragging, setIsDragging] = useState(false);
  const handleMouseDown = (dayIndex: number, slotIndex: number) => {
      setIsDragging(true);
      handleSlotClick(dayIndex, slotIndex);
  };
  const handleMouseEnter = (dayIndex: number, slotIndex: number) => {
      if (isDragging) {
          handleSlotClick(dayIndex, slotIndex);
      }
  };
  const handleMouseUp = () => setIsDragging(false);

  // Scroll Preservation & Zoom Anchor
  const prevGranularity = useRef(granularity);
  const lastInteractedSlotRef = useRef<{ slotIndex: number, offsetFromTop: number } | null>(null);

  useEffect(() => {
     if (!scrollContainerRef.current) return;
     const container = scrollContainerRef.current;
     
     // New constants
     const NEW_MIN_SLOT_HEIGHT = 20;
     const newHourHeight = (60 / granularity) * NEW_MIN_SLOT_HEIGHT;
     const newSlotHeight = newHourHeight / 12; // 5 min interval height

     // If we have a target slot to anchor
     if (lastInteractedSlotRef.current) {
         const { slotIndex, offsetFromTop } = lastInteractedSlotRef.current;
         // Calculate where this slot IS now in the new grid
         const newSlotDiffVal = slotIndex * newSlotHeight;
         
         // We want: newSlotY - newScrollTop = offsetFromTop
         // So: newScrollTop = newSlotY - offsetFromTop
         container.scrollTop = newSlotDiffVal - offsetFromTop;
     } else {
         // Fallback to ratio scaling if no specific interaction
         const prevG = prevGranularity.current;
         const ratio = prevG / granularity; // Ratio of Total Height change.
         container.scrollTop = container.scrollTop * ratio;
     }

     prevGranularity.current = granularity;
  }, [granularity]);

  const MIN_SLOT_HEIGHT = 20;
  // hourHeight: Height of 1 hour in pixels
  const hourHeight = (60 / granularity) * MIN_SLOT_HEIGHT;
  // slotHeight: Height of one 5-minute block
  const slotHeight = hourHeight / 12;

  const handleWeekChange = (offset: number) => {
    setStartWeekDate(prev => addDays(prev, offset * 7));
  };
  
  // Update anchor on interaction
  const recordInteraction = (slotIndex: number) => {
      if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          // Calculate current visual offset of this slot
          // SlotY = slotIndex * slotHeight
          // Offset = SlotY - ScrollTop
          const slotPixelY = slotIndex * slotHeight;
          const offset = slotPixelY - container.scrollTop;
          lastInteractedSlotRef.current = { slotIndex, offsetFromTop: offset };
      }
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          // Prepare Palette Data for DB (Array format)
          // We save everything EXCEPT 'black' title if we want to follow 'don't save black', 
          // BUT user said "blackは保存するな" meaning don't persist it for next reload.
          // However, we might as well just save current state, and the Reload Logic (useEffect ^) handles the reset.
          // That is cleaner.
          // But wait, if we save 'black'='Work', next time it resets to ''.
          // So saving it is fine.

          const paletteToSave = Object.entries(colorTitles).map(([key, title]) => ({
             key,
             title,
             hex: COLORS.find(c => c.key === key)?.hex || '#000000'
          }));

          // 1. Save Palette Configuration first
          await updatePalette(paletteToSave);

          const eventsToCreate: any[] = [];
          
          // Iterate all day keys in paintedData
          Object.entries(paintedData).forEach(([dayKey, daySlots]) => {
              // Parse date from key yyyy-MM-dd
              const [y, m, d] = dayKey.split('-').map(Number);
              const currentDayDate = new Date(y, m - 1, d);
              
              let currentEvent: { startSlot: number, color: string } | null = null;
              
              const processEvent = (endSlot: number) => {
                   if (!currentEvent) return;
                   
                   // Calculate times
                   // Start time
                   const startTotalMin = currentEvent.startSlot * 5;
                   // const startHour = HOURS_START + Math.floor(startTotalMin / 60);
                   // const startMin = startTotalMin % 60;
                   
                   const endTotalMin = endSlot * 5;
                   // const endHour = HOURS_START + Math.floor(endTotalMin / 60);
                   // const endMin = endTotalMin % 60;
                   
                   // Handle date overflow (24+)
                   const base = setMinutes(setHours(currentDayDate, 4), 0);
                   const startDate = addMinutes(base, startTotalMin);
                   const endDate = addMinutes(base, endTotalMin);
                   
                   // Look up title from local state
                   let title = colorTitles[currentEvent.color] || 'Event';

                   // Special logic for Black: if empty, default to "なんか"
                   if (currentEvent.color === 'black' && !title.trim()) {
                       title = 'なんか';
                   }
                   
                   // Note: If using multiple titles for same color in future, need logic.
                   // Current spec: 1 title per color.

                   eventsToCreate.push({
                       title,
                       memo: '',
                       startTime: startDate,
                       endTime: endDate,
                   });
              };
              
               for (let i = 0; i < daySlots.length; i++) {
                  const color = daySlots[i] || 'transparent'; // Handle sparse if any
                  
                  if (color === 'transparent') {
                      if (currentEvent) {
                          processEvent(i); // Ends at i (exclusive)
                          currentEvent = null;
                      }
                  } else {
                      if (!currentEvent) {
                          currentEvent = { startSlot: i, color };
                      } else if (currentEvent.color !== color) {
                          processEvent(i);
                          currentEvent = { startSlot: i, color };
                      }
                      // else continue existing event
                  }
              }
              // End of day closure
              if (currentEvent) {
                   processEvent(daySlots.length);
              }
          });

          // Batch create
          for (const evt of eventsToCreate) {
              await createGoogleEvent({
                  title: evt.title,
                  memo: evt.memo,
                  startTime: evt.startTime,
                  endTime: evt.endTime
              });
          }
          
          onSuccess();
          
      } catch (e) {
          console.error(e);
          alert('Error creating events');
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <Dialog 
        fullScreen 
        open={true} 
        onClose={onBack} 
        TransitionComponent={Transition}
        sx={{ zIndex: 1300 }} // Ensure high z-index
    >
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        {/* Header with Week Navigation */}
        <Box sx={{ 
          p: 1, 
          borderBottom: 1, 
          borderColor: 'divider', 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: 1, 
          bgcolor: 'background.paper', 
          zIndex: 20 
        }}>
          {/* Top row: Close button, title, OK button */}
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <IconButton onClick={onBack}><CloseIcon /></IconButton>
            <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>一括作成</Typography>
            <Button variant="contained" onClick={handleSave} disabled={isSaving} size="small">
                {isSaving ? '保存中...' : 'OK'}
            </Button>
          </Box>
          
          {/* Week selector - centered on mobile */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 1,
            alignSelf: { xs: 'center', sm: 'auto' },
            minWidth: 'fit-content'
          }}>
            <IconButton size="small" onClick={() => handleWeekChange(-1)}><ChevronLeftIcon /></IconButton>
            <Typography variant="body2" sx={{ mx: 1, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              {format(startWeekDate, 'M/d', { locale: ja })} 〜 {format(addDays(startWeekDate, 6), 'M/d', { locale: ja })}
            </Typography>
            <IconButton size="small" onClick={() => handleWeekChange(1)}><ChevronRightIcon /></IconButton>
          </Box>
        </Box>

        {/* Grid Container - CSS Grid for Perfect Alignment */}
        <Box 
            ref={scrollContainerRef}
            sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                overscrollBehavior: 'none',
                WebkitOverflowScrolling: 'touch',
                pb: 12, // Bottom padding for palette overlay
                pr: 8   // Right padding for granularity slider overlay
            }}
        >
            {/* CSS Grid Layout - Unified coordinate system */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: '50px repeat(7, minmax(60px, 1fr)) 60px',
                gridTemplateRows: `50px repeat(${HOURS_END - HOURS_START}, ${hourHeight}px) 80px`,
                minWidth: 'fit-content'
            }}>
                {/* Corner Cell (row 1, col 1) - Sticky */}
                <Box sx={{ 
                    gridRow: 1,
                    gridColumn: 1,
                    position: 'sticky', 
                    top: 0,
                    left: 0,
                    zIndex: 40,
                    bgcolor: 'background.default',
                    borderRight: 1,
                    borderBottom: 1,
                    borderColor: 'divider'
                }} />

                {/* Day Headers (row 1, cols 2-8) - Sticky top */}
                {days.map((day, dIdx) => (
                    <Box 
                        key={`header-${dIdx}`}
                        sx={{ 
                            gridRow: 1,
                            gridColumn: dIdx + 2,
                            position: 'sticky', 
                            top: 0, 
                            zIndex: 20, 
                            bgcolor: 'background.paper', 
                            borderBottom: 1, 
                            borderRight: 1,
                            borderColor: 'divider', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Typography variant="body2" fontWeight="bold">
                           {format(day, 'MM/dd')} ({['日', '月', '火', '水', '木', '金', '土'][day.getDay()]})
                        </Typography>
                    </Box>
                ))}

                {/* Time Labels (col 1, rows 2+) - Sticky left */}
                {Array.from({ length: HOURS_END - HOURS_START }).map((_, i) => (
                    <Box 
                        key={`time-${i}`}
                        sx={{ 
                            gridRow: i + 2,
                            gridColumn: 1,
                            position: 'sticky', 
                            left: 0, 
                            zIndex: 30, 
                            bgcolor: 'background.default',
                            borderRight: 1, 
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center'
                        }}
                    >
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: 'text.secondary',
                                transform: 'translateY(-50%)'
                            }}
                        >
                            {HOURS_START + i}:00
                        </Typography>
                    </Box>
                ))}
                {/* Final time label at bottom */}
                <Box 
                    sx={{ 
                        gridRow: HOURS_END - HOURS_START + 2,
                        gridColumn: 1,
                        position: 'sticky', 
                        left: 0, 
                        zIndex: 30, 
                        bgcolor: 'background.default',
                        borderRight: 1, 
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        height: 40 // Extra row for label visibility
                    }}
                >
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            color: 'text.secondary',
                            transform: 'translateY(-50%)'
                        }}
                    >
                        {HOURS_END}:00
                    </Typography>
                </Box>

                {/* Day Columns with Slots (cols 2-8, rows 2+) */}
                {days.map((day, dIdx) => (
                    <React.Fragment key={`day-${dIdx}`}>
                        {Array.from({ length: HOURS_END - HOURS_START }).map((_, hourIdx) => (
                            <Box 
                                key={`cell-${dIdx}-${hourIdx}`}
                                sx={{ 
                                    gridRow: hourIdx + 2,
                                    gridColumn: dIdx + 2,
                                    borderRight: 1,
                                    borderTop: 1,
                                    borderColor: 'divider',
                                    position: 'relative'
                                }}
                            >
                                {/* 30 min line */}
                                <Box sx={{ 
                                    position: 'absolute', 
                                    top: '50%', 
                                    left: 0, 
                                    right: 0, 
                                    borderTop: 1, 
                                    borderColor: 'divider', 
                                    opacity: 0.3
                                }} />
                                
                                {/* 15/45 min lines (only if granularity is 5) */}
                                {granularity === 5 && (
                                    <>
                                        <Box sx={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: 1, borderColor: 'divider', opacity: 0.15 }} />
                                        <Box sx={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: 1, borderColor: 'divider', opacity: 0.15 }} />
                                    </>
                                )}
                                
                                {/* Interactive slots for this hour (12 x 5min slots) */}
                                {Array.from({ length: 12 }).map((_, slotInHour) => {
                                    const sIdx = hourIdx * 12 + slotInHour;
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const colorKey = paintedData[dayKey]?.[sIdx] || 'transparent';
                                    const colorHex = COLORS.find(c => c.key === colorKey)?.hex || 'transparent';
                                    const eventCount = existingEventsSlots[dayKey]?.get(sIdx) || 0;
                                    // 濃さ: 1イベント=0.1, 2=0.2, 3+=0.3 (最大)
                                    const existingOpacity = Math.min(0.1 * eventCount, 0.4);
                                    
                                    return (
                                        <Box 
                                            key={sIdx}
                                            onMouseDown={() => {
                                                recordInteraction(sIdx);
                                                handleMouseDown(dIdx, sIdx);
                                            }}
                                            onMouseEnter={() => {
                                                if (isDragging) recordInteraction(sIdx);
                                                handleMouseEnter(dIdx, sIdx);
                                            }}
                                            sx={{ 
                                                position: 'absolute',
                                                top: `${(slotInHour / 12) * 100}%`,
                                                left: 0,
                                                right: 0,
                                                height: `${(1 / 12) * 100}%`,
                                                bgcolor: colorKey !== 'transparent' 
                                                    ? colorHex 
                                                    : eventCount > 0 
                                                        ? `rgba(0,0,0,${existingOpacity})` 
                                                        : 'transparent',
                                                opacity: colorKey === 'transparent' ? (eventCount > 0 ? 1 : 0) : 0.8,
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: colorKey === 'transparent' 
                                                        ? (eventCount > 0 ? `rgba(0,0,0,${existingOpacity + 0.05})` : 'rgba(0,0,0,0.05)') 
                                                        : colorHex,
                                                    opacity: 1
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        ))}
                    </React.Fragment>
                ))}
                
                {/* Bottom row for padding and final border */}
                <Box sx={{ 
                    gridRow: HOURS_END - HOURS_START + 2,
                    gridColumn: '2 / -1',
                    height: 40,
                    borderTop: 1,
                    borderColor: 'divider'
                }} />
            </Box>
        </Box>


        {/* Right Side Palette - Vertical */}
        <Box sx={{
            position: 'fixed',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            zIndex: 100
        }}>
            {COLORS.map((c) => (
                <Box
                    key={c.key}
                    onClick={() => setSelectedColor(c.key)}
                    sx={{
                        width: 36,
                        height: 36,
                        bgcolor: c.hex, 
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        boxShadow: 2,
                        ...(c.key === 'transparent' && {
                            border: '2px dashed',
                            borderColor: selectedColor === 'transparent' ? 'text.primary' : 'divider',
                            bgcolor: 'rgba(255,255,255,0.8)'
                        }),
                        ...(selectedColor === c.key && {
                            transform: 'scale(1.2)',
                            boxShadow: 4,
                            border: c.key !== 'transparent' ? '3px solid white' : undefined,
                            outline: c.key !== 'transparent' ? '2px solid #333' : undefined
                        })
                    }}
                >
                     {selectedColor === c.key && (
                         <CheckIcon sx={{ color: c.contrast, fontSize: 16 }} />
                     )}
                </Box>
            ))}
        </Box>

        {/* Bottom Center Granularity - Horizontal */}
        <Box sx={{
            position: 'fixed',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 100
        }}>
            {[5, 10, 15, 30].map((val) => (
                <Box
                    key={val}
                    onClick={() => setGranularity(val)}
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        bgcolor: granularity === val ? 'primary.main' : 'rgba(255,255,255,0.9)',
                        color: granularity === val ? 'primary.contrastText' : 'text.secondary',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        boxShadow: granularity === val ? 3 : 1,
                        transition: 'all 0.15s',
                        '&:hover': {
                            bgcolor: granularity === val ? 'primary.dark' : 'action.hover',
                            transform: 'scale(1.1)'
                        }
                    }}
                >
                    {val}
                </Box>
            ))}
        </Box>

        {/* Bottom Center Title Input - Below Granularity */}
        <Box sx={{
            position: 'fixed',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 300,
            zIndex: 100
        }}>
            <TextField 
                size="small" 
                fullWidth
                disabled={selectedColor === 'transparent'}
                placeholder={selectedColor === 'transparent' ? '' : 'タイトルを入力...'} 
                value={selectedColor === 'transparent' ? '' : (colorTitles[selectedColor] || '')} 
                onChange={(e) => setColorTitles(prev => ({...prev, [selectedColor]: e.target.value}))}
                sx={{ 
                    '& .MuiOutlinedInput-root': { 
                        bgcolor: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: 2
                    }
                }}
            />
        </Box>

    </Box>
    </Dialog>
  );
}
