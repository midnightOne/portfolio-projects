/**
 * Example usage of ClickableMediaUpload component
 * This file demonstrates the component's modularity and reusability
 */

import { useState } from 'react';
import { ClickableMediaUpload } from './clickable-media-upload';
import { MediaItem } from '@/lib/types/project';

// Example 1: Basic usage with project thumbnail
export function ProjectThumbnailUpload({ projectId }: { projectId: string }) {
  const [thumbnail, setThumbnail] = useState<MediaItem | undefined>();
  const [error, setError] = useState<string>('');

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Project Thumbnail</label>
      <ClickableMediaUpload
        currentMedia={thumbnail}
        projectId={projectId}
        onMediaSelect={setThumbnail}
        onMediaRemove={() => setThumbnail(undefined)}
        onError={setError}
        aspectRatio="16:9"
        maxSize={5 * 1024 * 1024} // 5MB limit
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Example 2: Square avatar upload with custom placeholder
export function AvatarUpload({ currentAvatar, onAvatarChange }: {
  currentAvatar?: MediaItem;
  onAvatarChange: (avatar: MediaItem | undefined) => void;
}) {
  return (
    <ClickableMediaUpload
      currentMedia={currentAvatar}
      onMediaSelect={onAvatarChange}
      onMediaRemove={() => onAvatarChange(undefined)}
      aspectRatio="square"
      maxSize={2 * 1024 * 1024} // 2MB limit for avatars
      acceptedTypes={['image/jpeg', 'image/png']} // Only JPEG and PNG
      placeholder={
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full mb-3" />
          <p className="text-sm font-medium">Upload Avatar</p>
          <p className="text-xs text-gray-500">JPEG or PNG, max 2MB</p>
        </div>
      }
      className="max-w-xs mx-auto"
    />
  );
}

// Example 3: Custom upload handler
export function CustomUploadExample() {
  const [media, setMedia] = useState<MediaItem | undefined>();

  const handleCustomUpload = async (file: File): Promise<MediaItem> => {
    // Custom upload logic - could upload to different service
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/custom-upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Custom upload failed');
    }
    
    const result = await response.json();
    return result.mediaItem;
  };

  return (
    <ClickableMediaUpload
      currentMedia={media}
      onMediaSelect={setMedia}
      onMediaRemove={() => setMedia(undefined)}
      onDirectUpload={handleCustomUpload}
      aspectRatio="4:3"
    />
  );
}

// Example 4: Gallery item upload with validation
export function GalleryItemUpload({ 
  onItemAdd, 
  acceptVideo = false 
}: { 
  onItemAdd: (item: MediaItem) => void;
  acceptVideo?: boolean;
}) {
  const acceptedTypes = acceptVideo 
    ? ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm']
    : ['image/jpeg', 'image/png', 'image/gif'];

  return (
    <ClickableMediaUpload
      onMediaSelect={onItemAdd}
      onMediaRemove={() => {}} // Not applicable for add-only mode
      acceptedTypes={acceptedTypes}
      maxSize={acceptVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024} // 50MB for video, 10MB for images
      placeholder={
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 bg-blue-100 rounded-lg mb-3 flex items-center justify-center">
            <span className="text-blue-600 text-xl">+</span>
          </div>
          <p className="text-sm font-medium">Add to Gallery</p>
          <p className="text-xs text-gray-500">
            {acceptVideo ? 'Images or videos' : 'Images only'}
          </p>
        </div>
      }
    />
  );
}