'use client';

import React, { useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  Image as ImageIcon
} from 'lucide-react';

interface CarouselImage {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
}

interface ImageCarouselNodeViewProps {
  node: {
    attrs: {
      images: CarouselImage[];
      autoPlay: boolean;
      showThumbnails: boolean;
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  selected: boolean;
}

export function ImageCarouselNodeView({ 
  node, 
  updateAttributes, 
  deleteNode,
  selected 
}: ImageCarouselNodeViewProps) {
  const { images, autoPlay, showThumbnails } = node.attrs;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-play functionality
  React.useEffect(() => {
    if (!isPlaying || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPlaying, images.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const toggleAutoPlay = useCallback(() => {
    const newAutoPlay = !isPlaying;
    setIsPlaying(newAutoPlay);
    updateAttributes({ autoPlay: newAutoPlay });
  }, [isPlaying, updateAttributes]);

  const handleEdit = useCallback(() => {
    // TODO: Open media selection modal
    setIsEditing(true);
    console.log('Edit carousel - open media selection modal');
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this image carousel?')) {
      deleteNode();
    }
  }, [deleteNode]);

  if (!images || images.length === 0) {
    return (
      <NodeViewWrapper className="image-carousel-node">
        <Card className={`border-2 border-dashed border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No images in carousel</p>
            <div className="flex gap-2">
              <Button onClick={handleEdit} size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Add Images
              </Button>
              <Button onClick={handleDelete} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </NodeViewWrapper>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <NodeViewWrapper className="image-carousel-node">
      <Card className={`overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardContent className="p-0">
          {/* Main Image Display */}
          <div className="relative group">
            <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={currentImage.url}
                alt={currentImage.alt || `Image ${currentIndex + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-image.png'; // Fallback image
                }}
              />
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Controls */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {images.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleAutoPlay}
                  title={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEdit}
                title="Edit carousel"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDelete}
                title="Delete carousel"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* Slide Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                    onClick={() => goToSlide(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Image Caption */}
          {currentImage.caption && (
            <div className="p-3 bg-gray-50 border-t">
              <p className="text-sm text-gray-600 text-center">
                {currentImage.caption}
              </p>
            </div>
          )}

          {/* Thumbnail Navigation */}
          {showThumbnails && images.length > 1 && (
            <div className="p-3 bg-gray-50 border-t">
              <div className="flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                      index === currentIndex ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    onClick={() => goToSlide(index)}
                  >
                    <img
                      src={image.url}
                      alt={image.alt || `Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Counter */}
          <div className="px-3 py-2 bg-gray-50 border-t text-center">
            <span className="text-xs text-gray-500">
              {currentIndex + 1} of {images.length}
            </span>
          </div>
        </CardContent>
      </Card>
    </NodeViewWrapper>
  );
}