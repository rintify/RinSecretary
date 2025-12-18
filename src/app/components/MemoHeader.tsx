'use client';

import { Box, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

interface MemoHeaderProps {
    title?: string;
    actions?: React.ReactNode;
    sx?: SxProps<Theme>;
}

export default function MemoHeader({ title = 'Memos', actions, sx }: MemoHeaderProps) {
    return (
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
            zIndex: 1100,
            position: 'sticky',
            top: 0,
            ...sx
        }}>
            <Typography variant="h6" fontWeight="bold">
                {title}
            </Typography>
            <Box>
                {actions}
            </Box>
        </Box>
    );
}
