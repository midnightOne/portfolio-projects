"use client";

import { CldImage } from 'next-cloudinary';
import { cn } from '@/lib/utils';

interface CloudinaryImageProps {
  publicId: string;
  alt: string;
  width: number;
  height: number;
  crop?: {
    type: 'auto' | 'fill' | 'fit' | 'scale' | 'pad';
    source?: boolean;
    gravity?: 'auto' | 'face' | 'center';
  };
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Optimized Cloudinary image component using next-cloudinary
 * Provides automatic optimization, transformations, and responsive delivery
 */
export function CloudinaryImage({
  publicId,
  alt,
  width,
  height,
  crop = { type: 'auto', source: true },
  quality = 'auto',
  format = 'auto',
  className,
  sizes,
  priority = false
}: CloudinaryImageProps) {
  return (
    <CldImage
      src={publicId}
      alt={alt}
      width={width}
      height={height}
      crop={crop}
      quality={quality}
      format={format}
      sizes={sizes}
      priority={priority}
      className={cn('transition-opacity duration-300', className)}
    />
  );
}

/**
 * Project thumbnail component with standard portfolio sizing
 */
export function ProjectThumbnail({
  publicId,
  alt,
  className
}: {
  publicId: string;
  alt: string;
  className?: string;
}) {
  return (
    <CloudinaryImage
      publicId={publicId}
      alt={alt}
      width={400}
      height={300}
      crop={{ type: 'fill', gravity: 'auto' }}
      quality="auto"
      format="auto"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className={cn('rounded-lg object-cover', className)}
    />
  );
}

/**
 * Project detail image with larger sizing
 */
export function ProjectDetailImage({
  publicId,
  alt,
  className,
  width = 800,
  height = 600
}: {
  publicId: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <CloudinaryImage
      publicId={publicId}
      alt={alt}
      width={width}
      height={height}
      crop={{ type: 'fit' }}
      quality="auto"
      format="auto"
      sizes="(max-width: 768px) 100vw, 80vw"
      className={cn('rounded-lg', className)}
    />
  );
}

/**
 * Avatar/profile image component
 */
export function CloudinaryAvatar({
  publicId,
  alt,
  size = 80,
  className
}: {
  publicId: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <CloudinaryImage
      publicId={publicId}
      alt={alt}
      width={size}
      height={size}
      crop={{ type: 'fill', gravity: 'face' }}
      quality="auto"
      format="auto"
      className={cn('rounded-full', className)}
    />
  );
} 