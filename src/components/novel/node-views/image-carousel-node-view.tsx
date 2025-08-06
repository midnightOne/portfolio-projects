'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageCarouselNodeViewProps {
  node: {
    attrs: {
      images: Array<{
        src: string;
        alt?: string;
        caption?: string;
      }>;
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
}

export function ImageCarouselNodeView({ 
  node, 
  updateAttributes, 
  deleteNode 
}: ImageCarouselNodeViewProps) {
  const { images } = node.attrs;
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <NodeViewWrapper className="image-carousel-node">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500">No images in carousel</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={deleteNode}
            className="mt-2"
          >
            Remove Carousel
          </Button>
        </div>
      </NodeViewWrapper>
    );
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const currentImage = images[currentIndex];

  return (
    <NodeViewWrapper className="image-carousel-node">
      <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4">
        {/* Main Image */}
        <div className="relative aspect-video">
          <img
            src={currentImage.src}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
          
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                onClick={prevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                onClick={nextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Dots Indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Caption */}
      {currentImage.caption && (
        <p className="text-sm text-gray-600 text-center italic">
          {currentImage.caption}
        </p>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <p className="text-xs text-gray-500 text-center mt-1">
          {currentIndex + 1} of {images.length}
        </p>
      )}
    </NodeViewWrapper>
  );
}