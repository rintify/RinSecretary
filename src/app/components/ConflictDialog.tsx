import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogContentText, 
    DialogActions, 
    Button, 
    Box, 
    Typography,
    useTheme,
    useMediaQuery
} from '@mui/material';
import * as Diff from 'diff';
import { useMemo } from 'react';

interface ConflictDialogProps {
    open: boolean;
    localContent: string;
    serverContent: string;
    onOverwrite: () => void;
    onDiscard: () => void;
    onCancel: () => void;
}

export default function ConflictDialog({ 
    open, 
    localContent, 
    serverContent, 
    onOverwrite, 
    onDiscard, 
    onCancel 
}: ConflictDialogProps) {
    
    const diff = useMemo(() => {
        return Diff.diffLines(serverContent, localContent);
    }, [serverContent, localContent]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Dialog 
            open={open} 
            onClose={onCancel} 
            maxWidth="md" 
            fullWidth
            fullScreen={isMobile}
        >
            <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
                編集の競合が発生しました
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    他の端末またはユーザーによってメモが更新されています。<br />
                    保存方法を選択してください。
                </DialogContentText>
                
                <Box sx={{ 
                    bgcolor: '#f5f5f5', 
                    borderRadius: 1, 
                    p: 2, 
                    maxHeight: '400px', 
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    border: '1px solid #e0e0e0'
                }}>
                    {diff.map((part, index) => {
                        const color = part.added ? '#e6ffec' : part.removed ? '#ffebe9' : 'transparent';
                        const textColor = part.added ? '#1b5e20' : part.removed ? '#c62828' : 'text.primary';
                        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                        
                        return (
                            <Box 
                                key={index} 
                                component="span" 
                                sx={{ 
                                    display: 'block', 
                                    bgcolor: color, 
                                    color: textColor,
                                    whiteSpace: 'pre-wrap'
                                }}
                            >
                                {part.value.replace(/\n$/, '').split('\n').map((line, i) => (
                                    <div key={i}>{prefix}{line}</div>
                                ))}
                            </Box>
                        );
                    })}
                </Box>
            </DialogContent>
            <DialogActions sx={{ 
                flexDirection: isMobile ? 'column' : 'row', 
                gap: isMobile ? 1 : 0,
                p: isMobile ? 2 : 1
            }}>
                <Button 
                    onClick={onCancel} 
                    color="inherit"
                    fullWidth={isMobile}
                    size={isMobile ? "large" : "medium"}
                >
                    キャンセル
                </Button>
                <Button 
                    onClick={onDiscard} 
                    color="warning"
                    fullWidth={isMobile}
                    size={isMobile ? "large" : "medium"}
                >
                    サーバーの内容を採用（破棄）
                </Button>
                <Button 
                    onClick={onOverwrite} 
                    variant="contained" 
                    color="error"
                    fullWidth={isMobile}
                    size={isMobile ? "large" : "medium"}
                >
                    上書き保存
                </Button>
            </DialogActions>
        </Dialog>
    );
}
