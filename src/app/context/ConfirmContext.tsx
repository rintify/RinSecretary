'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    Button, Typography, DialogContentText 
} from '@mui/material';

type ConfirmOptions = {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    severity?: 'info' | 'error' | 'warning';
};

type ConfirmContextType = {
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [options, setOptions] = useState<ConfirmOptions>({});
    
    // Promise resolver reference
    const resolveRef = useRef<(value: boolean) => void>(() => {});

    const confirm = useCallback((message: string, opts: ConfirmOptions = {}) => {
        setMessage(message);
        setOptions({
            title: '確認',
            confirmText: 'OK',
            cancelText: 'キャンセル',
            severity: 'info',
            ...opts
        });
        setOpen(true);

        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        setOpen(false);
        resolveRef.current(true);
    };

    const handleCancel = () => {
        setOpen(false);
        resolveRef.current(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Dialog
                open={open}
                onClose={() => handleCancel()} // Backdrop click cancels
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <DialogTitle id="confirm-dialog-title">
                    {options.title}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="confirm-dialog-description">
                        {message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button data-testid="confirm-dialog-cancel" onClick={handleCancel} color="inherit">
                        {options.cancelText}
                    </Button>
                    <Button 
                        data-testid="confirm-dialog-submit"
                        onClick={handleConfirm} 
                        color={options.severity === 'error' ? 'error' : 'primary'} 
                        autoFocus
                    >
                        {options.confirmText}
                    </Button>
                </DialogActions>
            </Dialog>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}
