'use client';

import { Box, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface MemoHeaderProps {
    title?: string;
    onBack?: () => void;
    backUrl?: string;
    actions?: React.ReactNode;
}

export default function MemoHeader({ title = 'Memos', onBack, backUrl, actions }: MemoHeaderProps) {
    const router = useRouter();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (backUrl) {
            router.push(backUrl);
        } else {
            router.back();
        }
    };

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
            top: 0
        }}>
            <Box display="flex" alignItems="center">
                <IconButton onClick={handleBack} edge="start" sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight="bold">
                    {title}
                </Typography>
            </Box>
            <Box>
                {actions}
            </Box>
        </Box>
    );
}
