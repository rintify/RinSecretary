'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Stack, Box, Typography, IconButton 
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { updatePalette } from '@/app/actions/palette';

interface PaletteEditModalProps {
  open: boolean;
  onClose: () => void;
  currentPalette: {
    black: string;
    red: string;
    blue: string;
    yellow: string;
    green: string;
    purple: string;
  };
  onUpdate: () => void;
}

const COLORS = [
  { key: 'black', label: 'Black', hex: '#000000', contrast: '#fff' },
  { key: 'red', label: 'Red', hex: '#f44336', contrast: '#fff' },
  { key: 'blue', label: 'Blue', hex: '#2196f3', contrast: '#fff' },
  { key: 'yellow', label: 'Yellow', hex: '#ffeb3b', contrast: '#000' },
  { key: 'green', label: 'Green', hex: '#4caf50', contrast: '#fff' },
  { key: 'purple', label: 'Purple', hex: '#9c27b0', contrast: '#fff' },
];

export default function PaletteEditModal({ open, onClose, currentPalette, onUpdate }: PaletteEditModalProps) {
  const [values, setValues] = useState(currentPalette);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValues(currentPalette);
  }, [currentPalette, open]);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updatePalette(values);
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to save palette settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth sx={{ zIndex: 1400 }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        Edit Event Palette
        <IconButton onClick={onClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set the default titles for each color.
        </Typography>
        <Stack spacing={2}>
          {COLORS.map((color) => (
            <Box key={color.key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 1, 
                  bgcolor: color.hex, 
                  border: '1px solid #ddd' 
                }} 
              />
              <TextField 
                fullWidth
                size="small"
                label={color.label}
                value={(values as any)[color.key]}
                onChange={(e) => handleChange(color.key, e.target.value)}
              />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
