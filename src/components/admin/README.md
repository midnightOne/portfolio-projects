# Unified Admin Navigation System

This directory contains the unified admin navigation system for the portfolio-projects application. The system provides a consistent, professional interface for all admin functionality across different specs.

## Architecture

### Core Layout Components

- **AdminLayout**: Main wrapper component that provides the sidebar and page structure
- **AdminSidebar**: Collapsible sidebar with expandable sections for all admin areas
- **AdminPageHeader**: Header with breadcrumb navigation and sidebar toggle
- **AdminPageLayout**: Consistent page wrapper with title, description, and actions

### Standard Components

- **AdminForm**: Standardized form component with consistent styling
- **AdminTable**: Feature-rich table with search, sorting, and pagination
- **AdminActions**: Consistent action button patterns

## Usage

### Basic Page Structure

```tsx
import { AdminLayout, AdminPageLayout } from '@/components/admin';

export default function MyAdminPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="Page Title"
        description="Page description"
        actions={<Button>Action</Button>}
      >
        {/* Page content */}
      </AdminPageLayout>
    </AdminLayout>
  );
}
```

### Using AdminForm

```tsx
import { AdminForm, AdminActions } from '@/components/admin';

function MyForm() {
  return (
    <AdminForm
      title="Form Title"
      description="Form description"
      actions={
        <AdminActions
          primary={{ label: 'Save', onClick: handleSave }}
          secondary={[{ label: 'Cancel', onClick: handleCancel }]}
        />
      }
    >
      {/* Form fields */}
    </AdminForm>
  );
}
```

### Using AdminTable

```tsx
import { AdminTable } from '@/components/admin';

function MyTable() {
  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'status', title: 'Status', render: (value) => <Badge>{value}</Badge> }
  ];

  const actions = [
    { label: 'Edit', onClick: (row) => handleEdit(row.id) },
    { label: 'Delete', onClick: (row) => handleDelete(row.id), variant: 'destructive' }
  ];

  return (
    <AdminTable
      data={data}
      columns={columns}
      actions={actions}
      searchable={true}
      pagination={true}
    />
  );
}
```

## Navigation Structure

The sidebar includes the following sections in order:

### Overview
- Dashboard

### Homepage
- Homepage Config (sections and global settings)

### Projects
- Project Dashboard (projects overview and management)
- New Project (always visible for quick access)
- All Projects (collapsible list)
  - Pure expand/collapse functionality - no navigation
  - Individual projects shown when expanded
  - Click project name to edit that project

### AI Assistant
- AI Settings

### Media Library
- Manage Media (upload and manage media files)
- Media Storage Providers (configure storage providers)

## Features

### Responsive Design
- Sidebar collapses to hamburger menu on mobile
- Desktop sidebar can be toggled for more workspace
- Touch-friendly navigation and form controls
- Bento grid layouts adapt to different screen sizes

### Accessibility
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly

### Consistent Styling
- Uses shadcn/ui components throughout
- Consistent spacing, typography, and colors
- Professional design language
- Bento grid layouts for optimal space utilization

### Breadcrumb Navigation
- Automatic breadcrumb generation based on URL
- Proper page hierarchy indication
- Current page highlighting

### Smart Projects Navigation
- **Project Dashboard** dedicated page for project overview and management
- **New Project** always visible for quick access
- **All Projects** collapsible section that:
  - Pure expand/collapse functionality (no unwanted navigation)
  - Shows individual projects when expanded
  - Allows direct navigation to edit specific projects
  - Loads projects dynamically with loading states
  - Shows project count badge when collapsed

### Bento Grid Layouts
- **AI Settings**: Environment configuration, model settings, and general settings arranged in a responsive bento grid
- **Homepage Config**: Section management and global settings combined in a unified bento grid layout
- Eliminates redundant navigation and maximizes screen real estate

## Migration from Old System

The old tab-based AdminLayout has been replaced with this sidebar-based system. All existing admin pages have been migrated to use the new components while preserving their functionality.

### Breaking Changes
- `AdminLayout` now requires no props (previously required `currentTab`)
- Page titles and descriptions are now handled by `AdminPageLayout`
- Navigation is automatic based on URL structure

### Backward Compatibility
- All existing admin components continue to work
- No changes required to existing form or table logic
- Only layout wrapper components needed updating

## Future Enhancements

This system is designed to support admin interfaces across all specs:
- ai-system: AI configuration and management
- media-management-system: Media library and uploads
- ui-system: Theme and component management
- rich-content-system: Content editing tools

Each spec can add its own sections to the navigation structure while maintaining consistency.