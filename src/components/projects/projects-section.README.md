# ProjectsSection Component

A highly configurable, reusable component for displaying project collections with filtering, search, and multiple layout options.

## Overview

The `ProjectsSection` component is designed to be the single source of truth for displaying projects across different contexts in the portfolio application. It supports multiple variants, layouts, and features while maintaining consistent behavior and appearance.

## Features

- **Multiple Layout Modes**: Grid, List, and Timeline views
- **Advanced Filtering**: Search by text and filter by tags
- **Flexible Sorting**: By date, title, or popularity
- **Responsive Design**: Adapts to all screen sizes
- **Theme Support**: Multiple theme variants with custom styling
- **Server-Side Rendering**: Full SSR support with client enhancement
- **Loading States**: Built-in skeleton screens and loading indicators
- **Accessibility**: Full keyboard navigation and screen reader support

## Basic Usage

```tsx
import { ProjectsSection, ProjectsSectionPresets } from '@/components/projects';

// Homepage featured projects
<ProjectsSection
  {...ProjectsSectionPresets.homepage}
  projects={projects}
  tags={tags}
  onProjectClick={(slug) => openProjectModal(slug)}
/>

// Full projects page
<ProjectsSection
  {...ProjectsSectionPresets.fullPage}
  projects={projects}
  tags={tags}
  onProjectClick={(slug) => router.push(`/projects/${slug}`)}
/>
```

## Props

### ProjectsSectionProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'homepage' \| 'full-page' \| 'featured'` | Yes | Determines the overall behavior and default settings |
| `config` | `ProjectsSectionConfig` | Yes | Configuration object controlling features and appearance |
| `projects` | `ProjectWithRelations[]` | No | Array of projects to display (can be empty for loading state) |
| `tags` | `Tag[]` | No | Available tags for filtering |
| `loading` | `boolean` | No | Whether to show loading skeletons |
| `onProjectClick` | `(slug: string) => void` | Yes | Callback when a project is clicked |
| `className` | `string` | No | Additional CSS classes |

### ProjectsSectionConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxItems` | `number \| undefined` | `undefined` | Maximum number of projects to show |
| `layout` | `'grid' \| 'timeline' \| 'list'` | `'grid'` | Display layout mode |
| `columns` | `2 \| 3 \| 4` | `3` | Number of columns for grid layout |
| `showSearch` | `boolean` | `false` | Enable search functionality |
| `showFilters` | `boolean` | `false` | Enable tag filtering |
| `showSorting` | `boolean` | `false` | Enable sort options |
| `showViewToggle` | `boolean` | `false` | Enable layout mode toggle |
| `theme` | `'default' \| 'dark' \| 'minimal' \| 'colorful'` | `'default'` | Visual theme |
| `spacing` | `'compact' \| 'normal' \| 'spacious'` | `'normal'` | Spacing between elements |
| `openMode` | `'modal' \| 'page'` | `'modal'` | How projects open when clicked |
| `filterTags` | `string[]` | `[]` | Pre-filter to specific tags |
| `sortBy` | `'date' \| 'title' \| 'popularity'` | `'date'` | Default sort order |
| `title` | `string` | `undefined` | Section title |
| `description` | `string` | `undefined` | Section description |
| `showViewCount` | `boolean` | `true` | Show project view counts |

## Variants

### Homepage Variant
- **Purpose**: Featured projects on homepage
- **Features**: Minimal controls, limited items
- **Layout**: Grid only
- **Best for**: Showcasing top projects

```tsx
<ProjectsSection
  variant="homepage"
  config={{
    maxItems: 6,
    layout: 'grid',
    showSearch: false,
    showFilters: false,
    title: 'Featured Projects'
  }}
  projects={projects}
  onProjectClick={handleClick}
/>
```

### Full-Page Variant
- **Purpose**: Dedicated projects page
- **Features**: All controls enabled
- **Layout**: All layouts available
- **Best for**: Complete project browsing experience

```tsx
<ProjectsSection
  variant="full-page"
  config={{
    layout: 'grid',
    showSearch: true,
    showFilters: true,
    showSorting: true,
    showViewToggle: true,
    title: 'All Projects'
  }}
  projects={projects}
  onProjectClick={handleClick}
/>
```

### Featured Variant
- **Purpose**: Curated project sections
- **Features**: Custom styling, selective controls
- **Layout**: Flexible
- **Best for**: Special project collections

```tsx
<ProjectsSection
  variant="featured"
  config={{
    maxItems: 4,
    layout: 'grid',
    columns: 2,
    theme: 'colorful',
    title: 'Award-Winning Projects'
  }}
  projects={projects}
  onProjectClick={handleClick}
/>
```

## Layout Modes

### Grid Layout
- **Best for**: Visual browsing, showcasing thumbnails
- **Features**: Configurable columns (2-4), responsive
- **Mobile**: Stacks to single column

### List Layout
- **Best for**: Detailed information, text-heavy content
- **Features**: Full project descriptions, metadata
- **Mobile**: Optimized for reading

### Timeline Layout
- **Best for**: Chronological browsing, project history
- **Features**: Grouped by year/month, visual timeline
- **Mobile**: Maintains timeline structure

## Theming

### Default Theme
- Standard portfolio colors
- Clean, professional appearance
- Good for most use cases

### Dark Theme
- Dark background with light text
- High contrast for readability
- Modern, sleek appearance

### Minimal Theme
- Clean white background
- Subtle borders and shadows
- Focused on content

### Colorful Theme
- Gradient backgrounds
- Vibrant accent colors
- Eye-catching, creative feel

## Preset Configurations

The component includes three preset configurations for common use cases:

```tsx
import { ProjectsSectionPresets } from '@/components/projects';

// Use presets directly
<ProjectsSection
  {...ProjectsSectionPresets.homepage}
  projects={projects}
  onProjectClick={handleClick}
/>

// Or extend presets
<ProjectsSection
  {...ProjectsSectionPresets.fullPage}
  config={{
    ...ProjectsSectionPresets.fullPage.config,
    theme: 'dark',
    maxItems: 20
  }}
  projects={projects}
  onProjectClick={handleClick}
/>
```

## Server-Side Rendering

The component fully supports SSR with progressive enhancement:

```tsx
// Server component
export default async function ProjectsPage() {
  const projects = await getProjects();
  const tags = await getTags();
  
  return (
    <ProjectsSection
      variant="full-page"
      config={{
        layout: 'grid',
        showSearch: true,
        showFilters: true,
        openMode: 'page' // Use page navigation for SSR
      }}
      projects={projects}
      tags={tags}
      onProjectClick={(slug) => {
        // Server-rendered links work without JS
        window.location.href = `/projects/${slug}`;
      }}
    />
  );
}
```

## Performance Considerations

- **Filtering**: Efficient client-side filtering with memoization
- **Sorting**: Optimized sorting algorithms
- **Rendering**: Virtual scrolling for large datasets (future enhancement)
- **Images**: Lazy loading built into project cards
- **Animations**: Respects user's reduced motion preferences

## Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Focus Management**: Logical tab order and focus indicators
- **Color Contrast**: Meets WCAG AA standards
- **Motion**: Respects `prefers-reduced-motion`

## Integration Examples

### With React Router
```tsx
import { useNavigate } from 'react-router-dom';

function ProjectsPage() {
  const navigate = useNavigate();
  
  return (
    <ProjectsSection
      variant="full-page"
      config={fullPageConfig}
      projects={projects}
      onProjectClick={(slug) => navigate(`/projects/${slug}`)}
    />
  );
}
```

### With Next.js
```tsx
import { useRouter } from 'next/router';

function ProjectsPage() {
  const router = useRouter();
  
  return (
    <ProjectsSection
      variant="full-page"
      config={fullPageConfig}
      projects={projects}
      onProjectClick={(slug) => router.push(`/projects/${slug}`)}
    />
  );
}
```

### With Modal Integration
```tsx
function ProjectsWithModal() {
  const [selectedProject, setSelectedProject] = useState(null);
  
  return (
    <>
      <ProjectsSection
        variant="homepage"
        config={homepageConfig}
        projects={projects}
        onProjectClick={(slug) => {
          const project = projects.find(p => p.slug === slug);
          setSelectedProject(project);
        }}
      />
      
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  );
}
```

## Testing

The component is designed to be easily testable:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsSection } from './projects-section';

test('filters projects by search query', () => {
  render(
    <ProjectsSection
      variant="full-page"
      config={{ showSearch: true }}
      projects={mockProjects}
      onProjectClick={jest.fn()}
    />
  );
  
  const searchInput = screen.getByPlaceholderText('Search projects...');
  fireEvent.change(searchInput, { target: { value: 'React' } });
  
  expect(screen.getByText('React Project')).toBeInTheDocument();
});
```

## Future Enhancements

- Virtual scrolling for large datasets
- Infinite scroll loading
- Advanced filtering (date ranges, multiple criteria)
- Export functionality
- Bulk operations
- Drag-and-drop reordering (admin mode)
- Custom layout templates
- Analytics integration