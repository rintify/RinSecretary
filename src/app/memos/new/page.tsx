import MemoHeader from '@/app/components/MemoHeader';
import MemoComposer from '@/app/components/MemoComposer';
import { Box } from '@mui/material';

export default function NewMemoPage() {
    return (
        <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <MemoHeader title="新規メモ" backUrl="/memos" />
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <MemoComposer />
            </Box>
        </Box>
    );
}
