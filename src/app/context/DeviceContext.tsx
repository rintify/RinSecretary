'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useMediaQuery } from '@mui/material';

type DeviceContextType = {
    isComputer: boolean;
};

const DeviceContext = createContext<DeviceContextType>({
    isComputer: false,
});

export function useDevice() {
    return useContext(DeviceContext);
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
    // Detect if device has a fine pointer (mouse/trackpad usually) and hover capability
    const hasFinePointer = useMediaQuery('(pointer: fine)');
    const hasHover = useMediaQuery('(hover: hover)');
    


    const [isComputer, setIsComputer] = useState(false);

    // We consider it a "computer" (desktop/laptop) if it has fine pointer + hover.
    // Screen size is ignored to support small windows on desktop.
    useEffect(() => {
        setIsComputer(hasFinePointer && hasHover);
    }, [hasFinePointer, hasHover]);

    return (
        <DeviceContext.Provider value={{ isComputer }}>
            {children}
        </DeviceContext.Provider>
    );
}
