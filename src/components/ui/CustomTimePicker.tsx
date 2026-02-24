'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, Typography, Box, Button, useTheme } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import CustomDatePicker from './CustomDatePicker';
import { GuideBubble } from './GuideBubble';

// localeをセット
dayjs.locale('ja');

interface CustomTimePickerProps {
  open: boolean;
  onClose: () => void;
  value: Date;
  onChange: (date: Date) => void;
  showDate?: boolean;
  guideMessage?: string;
  accentColor?: string;
}

export default function CustomTimePicker({
  open,
  onClose,
  value,
  onChange,
  showDate = true,
  guideMessage,
  accentColor,
}: CustomTimePickerProps) {
  const [currentDate, setCurrentDate] = useState(dayjs(value).tz());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastAngle = useRef<number | null>(null);
  const theme = useTheme();

  const mainColor = accentColor || theme.palette.primary.main;

  const [isOutside, setIsOutside] = useState(false);
  const isOutsideRef = useRef(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const handleDateSelect = (newDate: Date) => {
    setCurrentDate((prev) => {
      return dayjs(newDate).tz().hour(prev.hour()).minute(prev.minute());
    });
    setShowDatePicker(false);
  };

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentDate(dayjs(value).tz());
      lastAngle.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOutside(false);
      isOutsideRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsInteracting(false);
    }
  }, [open, value]);

  const getAngleAndDistance = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { angle: 0, distance: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = clientX - centerX;
    const y = clientY - centerY;

    let angleDeg = Math.atan2(y, x) * (180 / Math.PI);
    angleDeg += 90;
    if (angleDeg < 0) angleDeg += 360;

    const distance = Math.sqrt(x * x + y * y);

    return { angle: angleDeg, distance };
  };

  const accumulatedRotationRef = useRef(0);

  const handleUpdate = useCallback(
    (clientX: number, clientY: number, isFinal: boolean) => {
      const { angle, distance } = getAngleAndDistance(clientX, clientY);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const radius = rect.width / 2;

        const isInFixedZone = distance > radius * 1.05 || distance < radius * 0.65;
        if (isInFixedZone && !isFinal) {
          if (!isOutsideRef.current) {
            setIsOutside(true);
            isOutsideRef.current = true;
            accumulatedRotationRef.current = 0;
          }
        } else {
          if (isOutsideRef.current) {
            setIsOutside(false);
            isOutsideRef.current = false;
            accumulatedRotationRef.current = 0;
          }
        }
      }

      const currentAngle = angle;
      let dayChange = 0;
      let angleDelta = 0;

      if (lastAngle.current !== null) {
        const rawDelta = currentAngle - lastAngle.current;

        if (rawDelta < -180) {
          dayChange = 1;
        } else if (rawDelta > 180) {
          dayChange = -1;
        }

        angleDelta = rawDelta;
        if (angleDelta < -180) angleDelta += 360;
        if (angleDelta > 180) angleDelta -= 360;
      }

      lastAngle.current = currentAngle;

      if (isOutsideRef.current && !isFinal) {
        accumulatedRotationRef.current += angleDelta;

        const THRESHOLD = 20;
        const MINUTES_PER_STEP = 5;

        const steps = Math.trunc(accumulatedRotationRef.current / THRESHOLD);

        if (steps !== 0) {
          accumulatedRotationRef.current -= steps * THRESHOLD;
          const minutesToAdd = steps * MINUTES_PER_STEP;

          setCurrentDate((prev) => {
            const newDate = prev.add(minutesToAdd, 'minute');

            if (isFinal) {
              setTimeout(() => {
                onChange(newDate.toDate());
                onClose();
              }, 0);
            }
            return newDate;
          });
        }
        return;
      }

      let totalMinutes = Math.round(((currentAngle / 360) * 1440) / 5) * 5;

      if (totalMinutes === 1440) {
        totalMinutes = 1439;
      }

      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;

      setCurrentDate((prev) => {
        let newDate = prev;

        if (dayChange !== 0) {
          newDate = dayChange > 0 ? newDate.add(dayChange, 'day') : newDate.subtract(Math.abs(dayChange), 'day');
        }

        newDate = newDate.hour(hours).minute(minutes);

        if (isFinal) {
          setTimeout(() => {
            onChange(newDate.toDate());
            onClose();
          }, 0);
        }

        return newDate;
      });
    },
    [onChange, onClose],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsInteracting(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const { angle } = getAngleAndDistance(e.clientX, e.clientY);
    lastAngle.current = angle;
    handleUpdate(e.clientX, e.clientY, false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    handleUpdate(e.clientX, e.clientY, false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsInteracting(false);

    if (isOutsideRef.current) {
      setIsOutside(false);
      isOutsideRef.current = false;

      setTimeout(() => {
        onChange(currentDate.toDate());
        onClose();
      }, 0);
    } else {
      setIsOutside(false);
      isOutsideRef.current = false;
      handleUpdate(e.clientX, e.clientY, true);
    }
  };

  const totalMinutes = currentDate.hour() * 60 + currentDate.minute();
  const angle = (totalMinutes / 1440) * 360;

  const SIZE = 280;
  const CENTER = SIZE / 2;
  const RADIUS = CENTER - 20;

  const rad = (angle - 90) * (Math.PI / 180);
  const knobX = CENTER + RADIUS * Math.cos(rad);
  const knobY = CENTER + RADIUS * Math.sin(rad);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '95%',
          maxWidth: '360px',
          borderRadius: 4,
          p: 2,
          m: 'auto',
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          overflow: 'visible',
        },
      }}
    >
      {guideMessage && <GuideBubble message={guideMessage} />}
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' }}>
        <Box
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: '300px',
            aspectRatio: '1/1',
            touchAction: 'none',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            m: 'auto',
          }}
        >
          <svg style={{ width: '100%', height: '100%', display: 'block' }} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={isOutside ? mainColor : theme.palette.action.selected}
              strokeWidth="24"
              style={{ transition: 'stroke 0.3s ease' }}
            />

            {Array.from({ length: 12 }).map((_, i) => {
              const tickAngle = i * 30;
              const tickRad = (tickAngle - 90) * (Math.PI / 180);
              const outR = RADIUS;
              const inR = RADIUS - 10;
              const x1 = CENTER + outR * Math.cos(tickRad);
              const y1 = CENTER + outR * Math.sin(tickRad);
              const x2 = CENTER + inR * Math.cos(tickRad);
              const y2 = CENTER + inR * Math.sin(tickRad);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={theme.palette.text.disabled}
                  strokeWidth={i % 3 === 0 ? 3 : 1}
                />
              );
            })}

            <circle
              cx={knobX}
              cy={knobY}
              r="16"
              fill={mainColor}
              stroke={theme.palette.background.paper}
              strokeWidth="4"
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))' }}
            />
          </svg>

          <Box
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (showDate && !isInteracting) setShowDatePicker(true);
            }}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              cursor: showDate ? 'pointer' : 'default',
              pointerEvents: 'auto',
              userSelect: 'none',
              p: 2,
              borderRadius: '50%',
              '&:hover': {
                bgcolor: showDate ? 'action.hover' : 'transparent',
              },
            }}
          >
            {showDate && (
              <Typography variant="body1" color="text.secondary" fontWeight="bold">
                {currentDate.format('M/D(ddd)')}
              </Typography>
            )}
            <Typography variant="h3" fontWeight="bold" sx={{ color: mainColor }}>
              {currentDate.format('HH:mm')}
            </Typography>
          </Box>

          <Box
            sx={{
              position: 'absolute',
              transition: isInteracting ? 'opacity 0.2s ease-in' : 'opacity 0.2s ease-out',
              top: `${(knobY / SIZE) * 100}%`,
              left: `${(knobX / SIZE) * 100}%`,
              transform: 'translate(-50%, -130%)',
              opacity: isInteracting ? 1 : 0,
              pointerEvents: 'none',
              userSelect: 'none',
              textAlign: 'center',
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: theme.palette.background.paper,
              boxShadow: theme.shadows[8],
              border: `1px solid ${theme.palette.divider}`,
              zIndex: 1500,
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                borderWidth: '8px 8px 0 8px',
                borderStyle: 'solid',
                borderColor: `${theme.palette.background.paper} transparent transparent transparent`,
              },
            }}
          >
            {showDate && (
              <Typography variant="body2" color="text.secondary" fontWeight="bold">
                {currentDate.format('M/D(ddd)')}
              </Typography>
            )}
            <Typography variant="h4" fontWeight="bold" sx={{ color: mainColor, lineHeight: 1.2 }}>
              {currentDate.format('HH:mm')}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            width: '100%',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 40,
            mt: 3,
          }}
        >
          <Typography variant="caption" color="text.disabled">
            スライダーを回して時刻を変更
          </Typography>
          <Button
            variant="text"
            onClick={() => {
              onChange(currentDate.toDate());
              onClose();
            }}
            size="small"
            sx={{
              color: mainColor,
              minWidth: 60,
              fontWeight: 'bold',
              position: 'absolute',
              right: 0,
              '&:hover': {
                bgcolor: accentColor ? accentColor + '10' : 'rgba(0,0,0,0.05)',
              },
            }}
          >
            OK
          </Button>
        </Box>

        <CustomDatePicker
          open={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          value={currentDate.toDate()}
          onChange={handleDateSelect}
          accentColor={accentColor}
        />
      </DialogContent>
    </Dialog>
  );
}
