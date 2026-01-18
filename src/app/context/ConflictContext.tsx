'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
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
import { MEMO_COLOR } from '../utils/colors';

interface ConflictMemo {
    id: string;
    title: string;
    content: string;
    updatedAt: string;
}

interface ConflictItem {
    localMemo: ConflictMemo;
    serverMemo: ConflictMemo;
    labels?: { local?: string; server?: string; title?: string; message?: string };
    resolve: (choice: 'local' | 'server' | 'cancel') => void;
}

interface ConflictContextType {
    showConflict: (
        localMemo: ConflictMemo,
        serverMemo: ConflictMemo,
        labels?: { local?: string; server?: string; title?: string; message?: string }
    ) => Promise<'local' | 'server' | 'cancel'>;
}

const ConflictContext = createContext<ConflictContextType | null>(null);

export function useConflict() {
    const context = useContext(ConflictContext);
    if (!context) {
        throw new Error('useConflict must be used within ConflictProvider');
    }
    return context;
}

export function ConflictProvider({ children }: { children: ReactNode }) {
    const [conflict, setConflict] = useState<ConflictItem | null>(null);

    const showConflict = useCallback((
        localMemo: ConflictMemo,
        serverMemo: ConflictMemo,
        labels?: { local?: string; server?: string; title?: string; message?: string }
    ): Promise<'local' | 'server' | 'cancel'> => {
        return new Promise((resolve) => {
            setConflict({
                localMemo,
                serverMemo,
                labels,
                resolve: (choice) => {
                    setConflict(null);
                    resolve(choice);
                }
            });
        });
    }, []);

    const handleChoice = (choice: 'local' | 'server' | 'cancel') => {
        conflict?.resolve(choice);
    };

    // Diff Calculation
    const diff = useMemo(() => {
        if (!conflict) return [];
        return Diff.diffLines(conflict.serverMemo.content, conflict.localMemo.content);
    }, [conflict]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <ConflictContext.Provider value={{ showConflict }}>
            {children}
            <Dialog 
                data-testid="conflict-dialog"
                open={!!conflict} 
                onClose={() => handleChoice('cancel')} 
                maxWidth="md" 
                fullWidth
                fullScreen={isMobile}
                disableEscapeKeyDown
            >
                <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    {conflict?.labels?.title || '編集の競合が発生しました'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {conflict?.labels?.message || <>
                            他の端末またはユーザーによってメモが更新されています。<br />
                            保存方法を選択してください。
                        </>}
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
                        data-testid="conflict-dialog-cancel"
                        onClick={() => handleChoice('cancel')} 
                        color="inherit"
                        fullWidth={isMobile}
                        size={isMobile ? "large" : "medium"}
                    >
                        キャンセル
                    </Button>
                    <Button 
                        data-testid="conflict-dialog-server"
                        onClick={() => handleChoice('server')} 
                        color="warning"
                        fullWidth={isMobile}
                        size={isMobile ? "large" : "medium"}
                    >
                        {conflict?.labels?.server || 'サーバーの内容を採用（破棄）'}
                    </Button>
                    <Button 
                        data-testid="conflict-dialog-local"
                        onClick={() => handleChoice('local')} 
                        variant="contained" 
                        color="error"
                        fullWidth={isMobile}
                        size={isMobile ? "large" : "medium"}
                    >
                        {conflict?.labels?.local || '上書き保存'}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConflictContext.Provider>
    );
}
