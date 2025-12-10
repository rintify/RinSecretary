
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Box, Button, Typography, IconButton, Paper, 
  ToggleButton, ToggleButtonGroup, Slider, TextField,
  Select, MenuItem, FormControl, InputLabel, Tooltip, Stack
} from '@mui/material';
import { 
  Palette as PaletteIcon, 
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, addDays, startOfDay, addMinutes, setHours, setMinutes, subDays } from 'date-fns';
import { Dialog, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React, {  // Add React here
  forwardRef
} from 'react';
import PaletteEditModal from './PaletteEditModal';
import { getPalette } from '@/app/actions/palette';
import { createGoogleEvent } from '@/lib/calendar-actions';

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
const DEFAULT_PALETTE = {
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
  const [customTitle, setCustomTitle] = useState('');
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [paletteSettings, setPaletteSettings] = useState<any>(DEFAULT_PALETTE);
  
  // Persistence: Key = 'yyyy-MM-dd', Value = Array(288) of color keys
  const [paintedData, setPaintedData] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const fetchPalette = async () => {
    const p = await getPalette();
    if (p) setPaletteSettings(p);
  };
  
  // Fetch on mount
  useEffect(() => {
      fetchPalette();
  }, []);

  const days = useMemo(() => {
    const d = [];
    const start = startOfDay(startWeekDate);
    for (let i = 0; i < 7; i++) {
      d.push(addDays(start, i));
    }
    return d;
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
                   const startHour = HOURS_START + Math.floor(startTotalMin / 60);
                   const startMin = startTotalMin % 60;
                   
                   const endTotalMin = endSlot * 5;
                   const endHour = HOURS_START + Math.floor(endTotalMin / 60);
                   const endMin = endTotalMin % 60;
                   
                   // Handle date overflow (24+)
                   // Actually easy way: baseDate set to 4:00, add minutes
                   const base = setMinutes(setHours(currentDayDate, 4), 0);
                   const startDate = addMinutes(base, startTotalMin);
                   const endDate = addMinutes(base, endTotalMin);
                   
                   let title = 'New Event';
                   let memo = '';
                   
                   if (currentEvent.color === 'black') {
                       title = customTitle || 'Work';
                   } else {
                       // Look up title from palette
                       title = paletteSettings?.[currentEvent.color] || 'Event';
                   }

                   eventsToCreate.push({
                       title,
                       memo,
                       startTime: startDate,
                       endTime: endDate,
                       // We can't easily force color in GCal via this simple API unless we use colorId, 
                       // but for now we just create the event.
                       // Ideally we map color to colorId if needed, but per prompt just title is key.
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
          // Note: Sending many requests parallel might hit rate limits.
          // Sequential or chunks is safer.
          // For now, simple Promise.all with small groups or just all.
          // Let's do sequential to be safe and simple.
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
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', zIndex: 20 }}>
          <IconButton onClick={onBack}><CloseIcon /></IconButton>
          <Typography variant="h6" sx={{ ml: 1, mr: 2 }}>Bulk Create</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <IconButton size="small" onClick={() => handleWeekChange(-1)}><ChevronLeftIcon /></IconButton>
            <Typography variant="body2" sx={{ mx: 1, fontWeight: 'bold' }}>
              {format(startWeekDate, 'MMM d')} - {format(addDays(startWeekDate, 6), 'MMM d')}
            </Typography>
            <IconButton size="small" onClick={() => handleWeekChange(1)}><ChevronRightIcon /></IconButton>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
              <Button variant="contained" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'OK'}
              </Button>
          </Stack>
        </Box>

        {/* Controls (Sticky) */}
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', bgcolor: 'background.paper', zIndex: 20 }}>
            {/* Granularity Selector */}
            <FormControl size="small" sx={{ width: 120 }}>
                <InputLabel>Granularity</InputLabel>
                <Select
                    value={granularity}
                    label="Granularity"
                    onChange={(e) => setGranularity(Number(e.target.value))}
                >
                    <MenuItem value={5}>5 min</MenuItem>
                    <MenuItem value={10}>10 min</MenuItem>
                    <MenuItem value={15}>15 min</MenuItem>
                    <MenuItem value={30}>30 min</MenuItem>
                </Select>
            </FormControl>
            
            {/* Palette */}
            <Stack direction="row" spacing={1} alignItems="center">
                {COLORS.map((c) => (
                    <Box
                        key={c.key}
                        onClick={() => setSelectedColor(c.key)}
                        sx={{
                            width: 32, height: 32, bgcolor: c.hex, borderRadius: 1,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                            // "No X mark for transparent"
                            ...(c.key === 'transparent' && {
                                borderStyle: 'dashed',
                                borderColor: selectedColor === 'transparent' ? 'text.primary' : 'divider',
                                borderWidth: 1
                            }),
                            border: selectedColor === c.key && c.key !== 'transparent' ? '2px solid black' : undefined,
                            boxShadow: selectedColor === c.key ? 3 : 0
                        }}
                    >
                         {selectedColor === c.key && c.key !== 'transparent' && (
                             <CheckIcon sx={{ color: c.contrast, fontSize: 20 }} />
                         )}
                         {selectedColor === c.key && c.key === 'transparent' && (
                             <CheckIcon sx={{ color: 'text.primary', fontSize: 20 }} />
                         )}
                    </Box>
                ))}
            </Stack>
             
             {/* Edit Screen Button (Palette Icon) */}
             <Tooltip title="Edit Palette">
                 <IconButton onClick={() => setPaletteModalOpen(true)} size="small">
                     <PaletteIcon />
                 </IconButton>
             </Tooltip>
             
             {/* Custom Title Input */}
             {selectedColor === 'black' && (
                 <TextField 
                    size="small" 
                    placeholder="Title for Black" 
                    value={customTitle} 
                    onChange={(e) => setCustomTitle(e.target.value)}
                 />
             )}
        </Box>

        {/* Grid Container - Unified Scroll View for Perfect Alignment */}
        <Box 
            ref={scrollContainerRef}
            sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'row' }}
        >
            {/* Time Labels Column (Sticky Left) */}
            <Box sx={{ 
                width: 50, 
                flexShrink: 0, 
                position: 'sticky', 
                left: 0, 
                zIndex: 30, 
                bgcolor: 'background.default',
                borderRight: 1, 
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 'max-content' // Ensure background/border stretches full length
            }}>
                {/* Corner Cell (Sticky Top) */}
                <Box sx={{ 
                    height: 50, // Match header height
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 40,
                    bgcolor: 'background.default',
                    borderBottom: 1,
                    borderColor: 'divider'
                }} />

                {/* Labels Container - Explicit Height to match Grid exactly */}
                <Box sx={{ 
                    position: 'relative', 
                    height: hourHeight * (HOURS_END - HOURS_START), // FORCE HEIGHT
                    flexGrow: 1 
                }}>
                     {Array.from({ length: HOURS_END - HOURS_START + 1 }).map((_, i) => (
                        <Typography 
                            key={i} 
                            variant="caption" 
                            sx={{ 
                                position: 'absolute',
                                top: i * hourHeight,
                                left: 0,
                                right: 0,
                                textAlign: 'center', 
                                transform: 'translateY(-50%)', 
                                color: 'text.secondary',
                                height: 'auto'
                            }}
                        >
                            {HOURS_START + i}:00
                        </Typography>
                    ))}
                </Box>
            </Box>
            
            {/* Day Columns */}
            {days.map((day, dIdx) => (
                <Box key={dIdx} sx={{ 
                    flex: '1 0 auto', // Force auto basis to respect content height
                    minWidth: 60, 
                    minHeight: 'max-content', // Ensure it grows with content
                    borderRight: 1, 
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative' // For sticky children context
                }}>
                    {/* Date Header (Sticky Top) */}
                    <Box sx={{ 
                        position: 'sticky', 
                        top: 0, 
                        zIndex: 20, 
                        bgcolor: 'background.paper', 
                        borderBottom: 1, 
                        borderColor: 'divider', 
                        p: 1, 
                        textAlign: 'center',
                        height: 50,
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Typography variant="body2" fontWeight="bold">
                           {format(day, 'MM/dd')} ({['日', '月', '火', '水', '木', '金', '土'][day.getDay()]})
                        </Typography>
                    </Box>

                    {/* Slots Container */}
                    <Box sx={{ position: 'relative', height: hourHeight * (HOURS_END - HOURS_START), flexShrink: 0 }}> 
                        {/* Background Lines (Using borderTop for precision) */}
                         {Array.from({ length: HOURS_END - HOURS_START }).map((_, i) => (
                            <Box 
                                key={`bg-${i}`} 
                                sx={{ 
                                    height: hourHeight, 
                                    borderTop: 1, // Change to Top, aligns with 4:00 label at 0
                                    borderColor: 'divider', 
                                    boxSizing: 'border-box',
                                    position: 'relative'
                                }} 
                            >
                                {/* 30 min line (Halfway) */}
                                <Box sx={{ 
                                    position: 'absolute', 
                                    top: '50%', left: 0, right: 0, 
                                    borderTop: 1, 
                                    borderColor: 'divider', 
                                    opacity: 0.3, // Lighter than main hour line
                                    borderStyle: 'solid'
                                }} />
                                
                                {/* 15/45 min lines (only if granularity is 5) */}
                                {granularity === 5 && (
                                    <>
                                        <Box sx={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: 1, borderColor: 'divider', opacity: 0.15 }} />
                                        <Box sx={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: 1, borderColor: 'divider', opacity: 0.15 }} />
                                    </>
                                )}
                            </Box>
                        ))}
                        {/* Final closing border */}
                         <Box sx={{ borderTop: 1, borderColor: 'divider' }} />
                        
                        {/* Interactive Grid Overlay */}
                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                             {Array.from({ length: 288 }).map((_, sIdx) => {
                                 // Lookup from paintedData
                                 const dayKey = format(day, 'yyyy-MM-dd');
                                 const colorKey = paintedData[dayKey]?.[sIdx] || 'transparent';
                                 
                                 const colorHex = COLORS.find(c => c.key === colorKey)?.hex || 'transparent';
                                 
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
                                             top: sIdx * slotHeight,
                                             left: 0,
                                             right: 0,
                                             height: slotHeight,
                                             
                                             bgcolor: colorHex,
                                             opacity: colorKey === 'transparent' ? 0 : 0.8,
                                             cursor: 'pointer',
                                             '&:hover': {
                                                 bgcolor: colorKey === 'transparent' ? 'rgba(0,0,0,0.05)' : colorHex
                                             },
                                             ...(colorKey === 'transparent' && { // Apply dashed border to transparent slots
                                                 borderStyle: 'dashed',
                                                 borderColor: 'divider',
                                                 borderWidth: '0 0 1px 0' 
                                             })
                                         }}
                                     />
                                 );
                             })}
                        </Box>
                    </Box>
                </Box>
            ))}
        </Box>

        {/* Palette Modal - Always render with defaults if needed */}
         <Box sx={{ position: 'absolute', zIndex: 1400 }}>
             <PaletteEditModal 
                 open={paletteModalOpen} 
                 onClose={() => setPaletteModalOpen(false)}
                 currentPalette={paletteSettings}
                 onUpdate={fetchPalette}
             />
         </Box>
    </Box>
    </Dialog>
  );
}
