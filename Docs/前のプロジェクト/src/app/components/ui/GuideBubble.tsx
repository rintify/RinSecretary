
import { Box, Typography } from '@mui/material';

export const GuideBubble = ({ message }: { message: string }) => {
    return (
        <Box sx={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            borderRadius: 2,
            px: 2,
            py: 1,
            boxShadow: 3,
            zIndex: 1400, // Higher than Dialog (1300) ? Note: content is inside Dialog so zIndex is relative to stacking context if not fixed.
            // But if we put it inside Dialog content which has overflow:hidden usually... 
            // We need to render it ensuring it's visible.
            // We will set overflow: visible on the Dialog Paper.
            whiteSpace: 'nowrap',
            border: '1px solid',
            borderColor: 'divider',
            animation: 'float 2s ease-in-out infinite'
        }}>
            <Typography variant="body1" fontWeight="bold">
                {message}
            </Typography>
            <Box sx={{
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid',
                borderTopColor: 'background.paper',
                // We also need border effect if we have border on box... simplified for now.
            }} />
        </Box>
    );
};
