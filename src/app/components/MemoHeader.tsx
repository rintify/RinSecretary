'use client';

import { Box, Typography, InputBase, IconButton, Paper, LinearProgress } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';

interface MemoHeaderProps {
    title?: string;
    actions?: React.ReactNode;
    sx?: SxProps<Theme>;
    onSearchChange?: (value: string) => void;
    onSearchClick?: () => void;
    onClearClick?: () => void;
    value?: string;
    loading?: boolean;
}

export default function MemoHeader({ 
    title = 'Memos', 
    actions, 
    sx, 
    onSearchChange, 
    onSearchClick, 
    onClearClick, 
    value = '',
    loading = false
}: MemoHeaderProps) {
    return (
        <Box sx={{ 
            height: '60px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            px: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: '#f4eafa',
            flexShrink: 0,
            zIndex: 1100,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            ...sx
        }}>
            {onSearchChange ? (
                <Box sx={{ flex: 1, mr: 2, display: 'flex', alignItems: 'center' }}>
                    <Paper
                        component="form"
                        onSubmit={(e) => { 
                            e.preventDefault(); 
                            if (onClearClick && value) {
                                onClearClick();
                            } else {
                                onSearchClick?.(); 
                            }
                        }}
                        sx={{ 
                            p: '2px 4px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            width: '100%',
                            borderRadius: '20px',
                            bgcolor: 'rgba(255, 255, 255, 0.5)',
                            boxShadow: 'none',
                        }}
                    >
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder="メモを検索..."
                            inputProps={{ 'aria-label': 'search google maps' }}
                            value={value}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        {onClearClick && value ? (
                            <IconButton type="button" sx={{ p: '10px' }} aria-label="clear" onClick={onClearClick}>
                                <CloseIcon />
                            </IconButton>
                        ) : (
                            <IconButton type="submit" sx={{ p: '10px' }} aria-label="search">
                                <SearchIcon />
                            </IconButton>
                        )}
                    </Paper>
                </Box>
            ) : (
                <Typography 
                    variant="h6" 
                    fontWeight="bold" 
                    noWrap 
                    sx={{ flex: 1, minWidth: 0, mr: 2 }}
                >
                    {title}
                </Typography>
            )}
            <Box>
                {actions}
            </Box>
            {loading && (
                <LinearProgress 
                    color="inherit"
                    sx={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        left: 0, 
                        right: 0, 
                        height: '1px',
                        color: 'rgba(0, 0, 0, 0.2)', // Grey color
                        backgroundColor: 'transparent',
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: 'rgba(0, 0, 0, 0.2)'
                        }
                    }} 
                />
            )}
        </Box>
    );
}
