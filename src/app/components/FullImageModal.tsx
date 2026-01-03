import React, { useState, useEffect } from 'react';
import { Dialog, IconButton, Box } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Zoom, Navigation, Pagination } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';

import 'swiper/css';
import 'swiper/css/zoom';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface FullImageModalProps {
    open: boolean;
    onClose: () => void;
    imageUrl: string | null;
}

export default function FullImageModal({ open, onClose, imageUrl }: FullImageModalProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(false);
    }, [imageUrl]);

    if (!imageUrl) return null;

    const handleImageLoad = () => {
        setIsLoaded(true);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullScreen 
            disableScrollLock
            PaperProps={{
                style: {
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    boxShadow: 'none',
                },
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 1000,
                }}
            >
                <IconButton onClick={onClose} sx={{ color: 'rgba(150, 150, 150, 0.8)' }}>
                    <CloseIcon fontSize="large" />
                </IconButton>
            </Box>

            <Swiper
                style={{ width: '100%', height: '100%' }}
                zoom={true}
                modules={[Zoom, Navigation, Pagination]}
                className="mySwiper"
                onDoubleClick={(swiper) => {
                    if (swiper.zoom.scale > 1) {
                         swiper.zoom.out();
                    } else {
                         swiper.zoom.in();
                    }
                }}
            >
                <SwiperSlide>
                    <div className="swiper-zoom-container">
                        <AnimatePresence>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <motion.img 
                                key={imageUrl}
                                src={imageUrl} 
                                alt="Full Screen" 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: isLoaded ? 1 : 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                onLoad={handleImageLoad}
                                style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '100%', 
                                    objectFit: 'contain' 
                                }} 
                            />
                        </AnimatePresence>
                    </div>
                </SwiperSlide>
            </Swiper>
        </Dialog>
    );
}
