"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types/project';

interface ImageLightboxProps {
  images: MediaItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  isOpen,
  onClose
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  // Filter to only show image types
  const lightboxImages = images.filter(img => 
    img.type === 'IMAGE' || img.type === 'GIF'
  );

  // Reset zoom when image changes
  useEffect(() => {
    setIsZoomed(false);
  }, [currentIndex]);

  // Reset index when lightbox opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < lightboxImages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, lightboxImages.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          event.preventDefault();
          setIsZoomed(!isZoomed);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrevious, goToNext, isZoomed, onClose]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || lightboxImages.length === 0) return null;

  const currentImage = lightboxImages[currentIndex];

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const contentVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring" as const,
        duration: 0.4,
        bounce: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.2 }
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = currentImage.altText || `image-${currentIndex + 1}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          {/* Controls overlay */}
          <div className="absolute inset-0 z-10">
            {/* Top controls */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
              <div className="flex items-center space-x-2 text-white">
                <span className="text-sm bg-black/40 px-3 py-1 rounded">
                  {currentIndex + 1} / {lightboxImages.length}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsZoomed(!isZoomed);
                  }}
                >
                  {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                >
                  <Download className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Navigation arrows */}
            {lightboxImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 transition-opacity",
                    currentIndex === 0 ? "opacity-50 cursor-not-allowed" : "opacity-80 hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 transition-opacity",
                    currentIndex === lightboxImages.length - 1 ? "opacity-50 cursor-not-allowed" : "opacity-80 hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  disabled={currentIndex === lightboxImages.length - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Bottom info */}
            {currentImage.description && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/60 text-white p-4 rounded-lg backdrop-blur-sm">
                  <p className="text-sm leading-relaxed">
                    {currentImage.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Image container */}
          <motion.div
            className="flex items-center justify-center h-full p-8"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              key={currentImage.id}
              src={currentImage.url}
              alt={currentImage.altText || currentImage.description || 'Project image'}
              className={cn(
                "max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300",
                isZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsZoomed(!isZoomed)}
              draggable={false}
            />
          </motion.div>

          {/* Thumbnail strip */}
          {lightboxImages.length > 1 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
              <div className="flex space-x-2 bg-black/40 p-2 rounded-lg backdrop-blur-sm">
                {lightboxImages.map((image, index) => (
                  <button
                    key={image.id}
                    className={cn(
                      "w-12 h-8 rounded overflow-hidden border-2 transition-all duration-200",
                      index === currentIndex
                        ? "border-white scale-110"
                        : "border-transparent hover:border-white/60"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(index);
                    }}
                  >
                    <img
                      src={image.url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}