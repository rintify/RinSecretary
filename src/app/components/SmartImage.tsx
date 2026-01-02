import React, { useState, useRef, useEffect } from 'react';
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

    const imgRef = useRef<HTMLImageElement>(null);

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Avoid division by zero
        if (!naturalWidth || !naturalHeight) return;

        const imgAspect = naturalWidth / naturalHeight;
        
        // Estimate container aspect.
        // We use viewport height * 0.8 as the height constraint.
        // We use the image's parent width (or approximate) as width constraint.
        // Since we can't easily get parent width during onLoad without ref specific logic,
        // we can rely on the fact that if we set width: 100%, it fills parent.
        // If we set height: 80vh, it fills height.
        // We want to fill the "Tighter" dimension to maximize size without overflow/cropping.
        
        let containerWidth = window.innerWidth; 
        // Best effort: usage context often has padding. 
        // But comparing aspect ratios is relative.
        // If we are in a narrow column, width constraint is tight.
        // If we uses img.parentElement.clientWidth, it is accurate.
        if (img.parentElement) {
            containerWidth = img.parentElement.clientWidth;
        }

        const maxH = window.innerHeight * 0.8;
        const containerAspect = containerWidth / maxH;

        if (imgAspect < containerAspect) {
            // Image is "Taller" than the available box.
            // Limiting factor is HEIGHT.
            // We should set Height to Max (80vh), and let Width be auto (which will be < ContainerWidth).
            // This ensures tight fit vertical, and valid width.
            setStyle({
                height: '80vh',
                width: 'auto',
                // Reset others
                maxWidth: '100%', // Safety
                objectFit: 'contain',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'block',
                marginRight: 'auto', // Left align
                marginLeft: 0,
            });
        } else {
            // Image is "Wider" than the available box.
            // Limiting factor is WIDTH.
            // We should set Width to Max (100%), and let Height be auto (which will be < 80vh).
            setStyle({
                width: '100%',
                height: 'auto',
                // Reset others
                maxHeight: '80vh', // Safety
                objectFit: 'contain',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'block',
                marginRight: 'auto',
                marginLeft: 0,
            });
        }
    };

    // For external images, use Next.js Image
    if (src.startsWith('http')) {
        return (
             <Box sx={{ position: 'relative', width: 'fit-content', my: 2 }}>
                <Image
                    src={src}
                    alt={alt}
                    width={0}
                    height={0}
                    sizes="100vw"
                    quality={60}
                    onLoad={handleLoad}
                    onClick={onClick}
                    style={style}
                />
             </Box>
        );
    }

    // For local images, use standard img
    return (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            onClick={onClick}
            onLoad={handleLoad}
            style={style}
        />
    );
}
