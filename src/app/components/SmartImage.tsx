import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Box } from '@mui/material';

interface SmartImageProps {
    src: string;
    alt: string;
    onClick?: () => void;
    priority?: boolean;
}

export default function SmartImage({ src, alt, onClick, priority = false }: SmartImageProps) {
    // Default to 'safe' style that respects limits but might not upscale small images perfectly tight
    // or might leave gaps. We render this initially.
    const [style, setStyle] = useState<React.CSSProperties>({
        maxWidth: '100%',
        maxHeight: '80vh',
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'block',
        marginRight: 'auto',
        marginLeft: 0,
    });

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Avoid division by zero
        if (!naturalWidth || !naturalHeight) return;

        const imgAspect = naturalWidth / naturalHeight;
        
        let containerWidth = window.innerWidth; 
        if (img.parentElement) {
            containerWidth = img.parentElement.clientWidth;
        }

        const maxH = window.innerHeight * 0.8;
        const containerAspect = containerWidth / maxH;

        if (imgAspect < containerAspect) {
            // Image is "Taller" than the available box.
            setStyle({
                height: '80vh',
                width: 'auto',
                maxWidth: '100%', 
                objectFit: 'contain',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'block',
                marginRight: 'auto', 
                marginLeft: 0,
            });
        } else {
            // Image is "Wider" or fits.
            setStyle({
                width: '100%',
                height: 'auto',
                maxHeight: '80vh', 
                objectFit: 'contain',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'block',
                marginRight: 'auto',
                marginLeft: 0,
            });
        }
    };

    // Use Next.js Image for ALL images (external AND local) to enable optimization/bandwidth reduction.
    // We use width={0} height={0} sizes="100vw" to allow CSS (in style prop) to control dimensions
    // while Next.js generates an optimized image based on the sizes prop.
    return (
            <Box sx={{ position: 'relative', width: 'fit-content', my: 2 }}>
            <Image
                src={src}
                alt={alt}
                width={0}
                height={0}
                sizes="(max-width: 768px) 100vw, 800px" 
                quality={75}
                priority={priority}
                onLoad={handleLoad}
                onClick={onClick}
                style={style}
            />
            </Box>
    );
}

