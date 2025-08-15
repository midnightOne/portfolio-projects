# Image Carousel Testing Guide

This guide explains how to test the newly implemented image carousel functionality in the portfolio project editor.

## Features Implemented

### 1. Image Carousel Component (`/src/components/media/image-carousel.tsx`)
- **Touch/Swipe Support**: Full gesture support for mobile devices
- **Navigation Controls**: Arrow buttons and dot indicators
- **Individual Image Descriptions**: Each image displays its description
- **Keyboard Navigation**: Arrow keys for navigation
- **Auto-play Support**: Optional auto-play with configurable intervals
- **Thumbnail Navigation**: Optional thumbnail strip for quick navigation
- **Lightbox Integration**: Click images to view in full-screen lightbox

### 2. Tiptap Editor Integration
- **Slash Commands**: Type `/carousel` or `/Image Carousel` to insert a carousel
- **Visual Editor**: Drag-and-drop interface for managing carousel images
- **Media Selection Modal**: Choose from existing project media or upload new images

### 3. Admin Interface Integration
- **Enhanced Project Editor**: Carousel support in the rich text editor
- **Media Management**: Upload and organize images for carousels
- **Real-time Preview**: See carousel changes immediately in the editor

## How to Test

### Step 1: Start the Development Server
```bash
cd portfolio-projects
npm run dev
```

### Step 2: Access the Admin Interface
1. Navigate to `http://localhost:3000/admin`
2. Login with credentials:
   - Username: `admin`
   - Password: `admin2025`

### Step 3: Edit an Existing Project
1. Go to "Projects" in the admin dashboard
2. Click "Edit" on any existing project (e.g., "Portfolio Website")
3. Scroll down to the "Article Content" section

### Step 4: Insert an Image Carousel
1. Click in the article content editor
2. Type `/carousel` or `/Image Carousel`
3. Select "Image Carousel" from the dropdown
4. An empty carousel will be inserted

### Step 5: Add Images to the Carousel
1. Click the "Add Images" button on the empty carousel
2. The Media Selection Modal will open
3. Select existing images or upload new ones
4. Click on images to add them to the carousel
5. Close the modal to see the carousel with your selected images

### Step 6: Test Carousel Features
- **Navigation**: Use arrow buttons or dot indicators to navigate
- **Thumbnails**: Scroll through thumbnail strip at the bottom
- **Auto-play**: Click the play/pause button to toggle auto-play
- **Remove Images**: Hover over thumbnails and click the × button
- **Edit**: Click the edit button to add more images
- **Delete**: Click the trash button to remove the entire carousel

### Step 7: Test Frontend Display
1. Save the project
2. Navigate to the public project view at `http://localhost:3000`
3. Click on the project to open the modal
4. Verify the carousel displays correctly with:
   - Touch/swipe support on mobile devices
   - Smooth animations
   - Image descriptions
   - Lightbox functionality (click images to expand)

## Test Data Available

The seed data includes several projects with media items:

1. **Portfolio Website** - 3 media items (2 images, 1 GIF)
2. **Task Management App** - 3 media items (2 images, 1 video)  
3. **E-commerce Platform** - Multiple media items

## Troubleshooting

### Carousel Not Showing Images
- Ensure the project has media items uploaded
- Check browser console for any JavaScript errors
- Verify the media URLs are accessible

### Media Selection Modal Not Opening
- Ensure you're editing an existing project (not creating a new one)
- Check that the project ID is available in the URL
- Verify admin authentication is working

### Touch/Swipe Not Working
- Test on an actual mobile device or use browser dev tools mobile emulation
- Ensure Framer Motion is properly loaded
- Check for any CSS conflicts

## API Endpoints Used

- `GET /api/admin/projects/{id}/media` - Fetch project media items
- `POST /api/admin/projects/{id}/media` - Upload new media items
- `PUT /api/admin/projects/{id}` - Save project with carousel data

## File Structure

```
src/
├── components/
│   ├── media/
│   │   ├── image-carousel.tsx          # Main carousel component
│   │   ├── image-lightbox.tsx          # Lightbox for full-screen viewing
│   │   ├── download-button.tsx         # Enhanced download buttons
│   │   └── external-links.tsx          # Enhanced external links
│   ├── admin/
│   │   └── media-selection-modal.tsx   # Media selection interface
│   └── tiptap/
│       └── extensions/
│           ├── image-carousel.ts       # Tiptap carousel extension
│           └── node-views/
│               └── image-carousel-node-view.tsx  # Editor carousel UI
```

## Next Steps

1. **Test thoroughly** on different devices and browsers
2. **Add more media items** to test carousel performance with many images
3. **Customize styling** to match your design system
4. **Add analytics** to track carousel engagement
5. **Implement lazy loading** for better performance with many images

## Known Limitations

- Media selection modal requires an existing project (not available for new projects)
- Project ID detection relies on URL structure
- Large images may impact performance (consider implementing image optimization)