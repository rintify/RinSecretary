import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';

interface SmartImageProps {
    src: string;
    alt: string;
    onClick?: () => void;
    priority?: boolean;
}

const MotionImage = motion(Image);

export default function SmartImage({ src, alt, onClick, priority = false }: SmartImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
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
            // Image is "Wider" than the available box.
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
        setIsLoaded(true);
    };

    const imageMotionProps: any = {
        initial: { opacity: 0 },
        animate: { opacity: isLoaded ? 1 : 0 },
        transition: { duration: 0.4, ease: "easeOut" }
    };

    // For external images, use Next.js Image
    if (src.startsWith('http')) {
        return (
             <Box sx={{ position: 'relative', width: 'fit-content', my: 2 }}>
                <MotionImage
                    src={src}
                    alt={alt}
                    width={0}
                    height={0}
                    sizes="100vw"
                    quality={60}
                    onLoad={handleLoad}
                    onClick={onClick}
                    style={style}
                    {...imageMotionProps}
                />
             </Box>
        );
    }

    // Use Next.js Image for ALL images (external AND local) to enable optimization/bandwidth reduction.
    return (
        <MotionImage
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
            {...imageMotionProps}
        />
    );
}




