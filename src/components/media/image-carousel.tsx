"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/types/project';

interface ImageCarouselProps {
  images: MediaItem[];
  className?: string;
  showThumbnails?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

interface CarouselImage extends MediaItem {
  description?: string;
}

const SWIPE_CONFIDENCE_THRESHOLD = 10000;
const SWIPE_POWER_THRESHOLD = 50;

export function ImageCarousel({
  images,
  className,
  showThumbnails = true,
  autoPlay = false,
  autoPlayInterval = 5000
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Filter to only show image types for carousel
  const carouselImages = images.filter(img => 
    img.type === 'IMAGE' || img.type === 'GIF'
  ) as CarouselImage[];

  // Don't render if no images or only one image
  if (carouselImages.length === 0) return null;
  if (carouselImages.length === 1) {
    const singleImage = carouselImages[0];
    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative aspect-video rounded-lg overflow-hidden">
          <img
            src={singleImage.url}
            alt={singleImage.altText || singleImage.description || 'Project image'}
            className="w-full h-full object-cover"
          />
        </div>
        {singleImage.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {singleImage.description}
          </p>
        )}
      </div>
    );
  }

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || carouselImages.length <= 1) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prevIndex) => 
        prevIndex === carouselImages.length - 1 ? 0 : prevIndex + 1
      );
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, carouselImages.length]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex === carouselImages.length - 1) return;
    setDirection(1);
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, carouselImages.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const goToSlide = useCallback((index: number) => {
    if (index === currentIndex) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex]);

  // Drag/Swipe detection - improved to work with both touch and mouse
  const handleDragEnd = (event: any, { offset, velocity }: PanInfo) => {
    const dragDistance = Math.abs(offset.x);
    const dragVelocity = Math.abs(velocity.x);
    
    // Lower threshold for better responsiveness
    const isSignificantDrag = dragDistance > 50 || dragVelocity > 500;

    if (isSignificantDrag) {
      if (offset.x > 0) {
        // Dragged right - go to previous
        goToPrevious();
      } else {
        // Dragged left - go to next
        goToNext();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const swipeTransition = {
    x: { type: "spring" as const, stiffness: 300, damping: 30 },
    opacity: { duration: 0.2 }
  };

  const currentImage = carouselImages[currentIndex];

  return (
    <div className={cn("relative w-full", className)}>
      {/* Main carousel container */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={swipeTransition}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            whileDrag={{ scale: 0.95 }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <img
              src={currentImage.url}
              alt={currentImage.altText || currentImage.description || 'Project image'}
              className="w-full h-full object-cover select-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {carouselImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white transition-opacity",
                currentIndex === 0 ? "opacity-50 cursor-not-allowed" : "opacity-80 hover:opacity-100"
              )}
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Previous image</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white transition-opacity",
                currentIndex === carouselImages.length - 1 ? "opacity-50 cursor-not-allowed" : "opacity-80 hover:opacity-100"
              )}
              onClick={goToNext}
              disabled={currentIndex === carouselImages.length - 1}
            >
              <ChevronRight className="h-5 w-5" />
              <span className="sr-only">Next image</span>
            </Button>
          </>
        )}

        {/* Slide counter */}
        <div className="absolute bottom-2 left-2 bg-black/40 text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {carouselImages.length}
        </div>
      </div>

      {/* Navigation dots */}
      {carouselImages.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2">
          {carouselImages.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentIndex
                  ? "bg-primary scale-125"
                  : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
              )}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail navigation */}
      {showThumbnails && carouselImages.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2 overflow-x-auto pb-2">
          {carouselImages.map((image, index) => (
            <button
              key={image.id}
              className={cn(
                "flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all duration-200",
                index === currentIndex
                  ? "border-primary scale-105"
                  : "border-transparent hover:border-muted-foreground/40"
              )}
              onClick={() => goToSlide(index)}
            >
              <img
                src={image.url}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Image description */}
      {currentImage.description && (
        <motion.div
          key={`description-${currentIndex}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-3"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            {currentImage.description}
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Utility component for simple image carousel in articles
export function ArticleImageCarousel({
  images,
  className
}: {
  images: MediaItem[];
  className?: string;
}) {
  return (
    <div className={cn("my-6", className)}>
      <ImageCarousel
        images={images}
        showThumbnails={false}
      />
    </div>
  );
}