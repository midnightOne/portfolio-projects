# Requirements Document

## Introduction

This feature implements a comprehensive portfolio projects showcase website that will be hosted on a separate subdomain. The system will display a curated list of projects with rich media content, real-time filtering capabilities, and detailed project views. The platform should provide an engaging user experience with smooth animations and responsive design, allowing visitors to explore projects by categories and view detailed technical information in an article-like format.

## Requirements

### Requirement 1

**User Story:** As a portfolio visitor, I want to view a list of all projects with basic information, so that I can quickly browse through the available work.

#### Acceptance Criteria

1. WHEN the projects page loads THEN the system SHALL display all projects in a grid or list layout
2. WHEN displaying each project THEN the system SHALL show project name, tags, description, and preview image/video
3. WHEN the page loads THEN the system SHALL render responsively across desktop, tablet, and mobile devices
4. WHEN projects are displayed THEN the system SHALL use shadcn/ui components for consistent styling

### Requirement 2

**User Story:** As a portfolio visitor, I want to filter projects by tags in real-time, so that I can find projects relevant to my interests.

#### Acceptance Criteria

1. WHEN the page loads THEN the system SHALL display a navigation bar with filter options for tags (XR, AI, Game, 2D, 3D, etc.)
2. WHEN I click on a tag filter THEN the system SHALL immediately show only projects matching that tag
3. WHEN filtering occurs THEN the system SHALL animate the transition between filtered states
4. WHEN I select multiple tags THEN the system SHALL show projects that match any of the selected tags
5. WHEN I clear filters THEN the system SHALL show all projects again with smooth animations

### Requirement 3

**User Story:** As a portfolio visitor, I want to view detailed information about a specific project, so that I can understand the technical implementation and see comprehensive media.

#### Acceptance Criteria

1. WHEN I click on a project preview THEN the system SHALL open a popup/modal window with detailed project information
2. WHEN the detailed view opens THEN the system SHALL display a two-column layout with metadata on the left and main content on the right
3. WHEN viewing the metadata section THEN the system SHALL show title, medium-sized project image/GIF, brief overview, tags, work date, external links, and download button(s)
4. WHEN the metadata section is displayed THEN the system SHALL keep it floating/fixed while the main content is scrollable
5. WHEN viewing project details THEN the system SHALL present the main content as an article describing technical details
6. WHEN reading the article THEN the system SHALL embed relevant GIFs, WebMs, and videos inline with the text
7. WHEN images are displayed in the main content THEN the system SHALL support image carousels with multiple slides
8. WHEN image carousels are present THEN the system SHALL show navigation dots and arrow buttons for slide control
9. WHEN viewing images THEN the system SHALL display image descriptions in smaller font below each image
10. WHEN image descriptions are shown THEN the system SHALL match the width of the image element
11. WHEN project has downloadable files THEN the system SHALL display download links both in the metadata section and inline within the article text
12. WHEN multiple download files exist THEN the system SHALL provide a dropdown button showing all available files with their names
13. WHEN the popup is open THEN the system SHALL provide an X button in the top right corner to close it
14. WHEN clicking outside the project window THEN the system SHALL close the popup and return to the projects list
15. WHEN the popup opens or closes THEN the system SHALL animate the transition smoothly
16. WHEN a project is opened THEN the system SHALL update the browser URL to reflect the specific project
17. WHEN navigating directly to a project URL THEN the system SHALL open that project's detailed view
18. WHEN closing a project THEN the system SHALL update the URL back to the projects list and maintain browser history

### Requirement 4

**User Story:** As a portfolio owner, I want the website to be built on a reliable framework with modern UI components, so that it's maintainable and visually appealing.

#### Acceptance Criteria

1. WHEN building the application THEN the system SHALL use a modern web framework (React, Next.js, or WordPress)
2. WHEN implementing UI components THEN the system SHALL utilize shadcn/ui for consistent design elements
3. WHEN the site is deployed THEN the system SHALL be accessible via a separate subdomain
4. WHEN users interact with the site THEN the system SHALL provide smooth animations and transitions
5. WHEN the site loads THEN the system SHALL optimize for performance and SEO

### Requirement 5

**User Story:** As a portfolio visitor, I want the website to be fast and responsive, so that I have a smooth browsing experience across all devices.

#### Acceptance Criteria

1. WHEN accessing the site on any device THEN the system SHALL adapt the layout appropriately
2. WHEN filtering or navigating THEN the system SHALL respond within 200ms for optimal user experience
3. WHEN loading media content THEN the system SHALL implement lazy loading for images and videos
4. WHEN the site loads THEN the system SHALL achieve good Core Web Vitals scores
5. WHEN using animations THEN the system SHALL maintain 60fps performance

### Requirement 6

**User Story:** As a portfolio owner, I want a secure admin interface to manage project content, so that I can add, edit, or remove projects through a web-based CMS.

#### Acceptance Criteria

1. WHEN accessing the admin area THEN the system SHALL require authentication with username and password
2. WHEN logged in as admin THEN the system SHALL provide a dashboard to manage all projects
3. WHEN creating a new project THEN the system SHALL provide forms to input name, tags, description, and upload media files
4. WHEN editing an existing project THEN the system SHALL pre-populate forms with current data and allow modifications
5. WHEN deleting a project THEN the system SHALL require confirmation and remove all associated data and media files
6. WHEN managing media THEN the system SHALL support upload of images, videos, GIFs, and WebMs with file validation
7. WHEN managing project attachments THEN the system SHALL support upload of downloadable files (APK, executables, documents, etc.)
8. WHEN uploading attachments THEN the system SHALL validate file types and provide secure download URLs
9. WHEN managing external links THEN the system SHALL provide interface to add, edit, and remove project links with labels
10. WHEN managing interactive content THEN the system SHALL support uploading and configuring canvas/iframe/WebXR examples
11. WHEN managing image carousels THEN the system SHALL provide interface to upload multiple images, set order, and add descriptions
12. WHEN editing article content THEN the system SHALL support rich text editing with embedded media and project cross-references

### Requirement 7

**User Story:** As a portfolio owner, I want a backend API to store and serve project data, so that the frontend can dynamically load content and the CMS can manage it.

#### Acceptance Criteria

1. WHEN the system starts THEN the backend SHALL provide RESTful API endpoints for project CRUD operations
2. WHEN storing project data THEN the system SHALL use a database to persist project information and metadata
3. WHEN uploading media files THEN the system SHALL store files securely and provide accessible URLs
4. WHEN the frontend requests data THEN the system SHALL serve project information in JSON format
5. WHEN admin operations occur THEN the system SHALL validate permissions and data integrity
6. WHEN serving media THEN the system SHALL optimize delivery for web performance
7. WHEN serving downloadable attachments THEN the system SHALL provide secure download endpoints with proper headers
8. WHEN users download files THEN the system SHALL track download analytics and ensure file integrity
9. WHEN storing interactive content THEN the system SHALL securely handle iframe sources and WebXR assets
10. WHEN managing carousel data THEN the system SHALL store image order, descriptions, and metadata efficiently

### Requirement 8

**User Story:** As a portfolio visitor, I want to download project files and attachments, so that I can try applications or access additional project resources.

#### Acceptance Criteria

1. WHEN viewing a project with attachments THEN the system SHALL display download buttons in the metadata section and allow inline references in article text
2. WHEN multiple files are available THEN the system SHALL show a dropdown button with file names in the metadata section
3. WHEN clicking a download button THEN the system SHALL initiate a secure file download
4. WHEN downloading files THEN the system SHALL provide clear file names, sizes, and types
5. WHEN files are downloaded THEN the system SHALL serve them with appropriate MIME types and security headers
6. WHEN managing downloads THEN the system SHALL support various file types (APK, EXE, ZIP, PDF, etc.)
7. WHEN displaying download options THEN the system SHALL show file metadata (size, type, upload date)

### Requirement 9

**User Story:** As a portfolio visitor, I want to access external links related to projects, so that I can view live demos, source code, or related resources.

#### Acceptance Criteria

1. WHEN viewing the metadata section THEN the system SHALL display external links if they exist for the project
2. WHEN external links are present THEN the system SHALL show them with appropriate icons and labels (GitHub, Live Demo, etc.)
3. WHEN clicking external links THEN the system SHALL open them in new tabs/windows
4. WHEN managing projects THEN the admin SHALL be able to add, edit, and remove external links
5. WHEN displaying links THEN the system SHALL validate URLs and show link status if possible

### Requirement 10

**User Story:** As a portfolio visitor, I want to navigate between related projects through hyperlinks, so that I can explore connected work seamlessly.

#### Acceptance Criteria

1. WHEN reading project articles THEN the system SHALL support hyperlinks to other projects within the text
2. WHEN clicking a project reference link THEN the system SHALL open the referenced project's detailed view
3. WHEN navigating between projects THEN the system SHALL maintain browser history for back/forward functionality
4. WHEN managing project content THEN the admin SHALL be able to create internal links to other projects
5. WHEN project links are created THEN the system SHALL validate that referenced projects exist
6. WHEN displaying project links THEN the system SHALL style them distinctly from external links

### Requirement 11

**User Story:** As a portfolio visitor, I want to interact with live project examples and demos, so that I can experience the projects directly within the portfolio.

#### Acceptance Criteria

1. WHEN viewing projects with interactive content THEN the system SHALL support embedding canvas elements and iframes
2. WHEN projects include WebXR experiences THEN the system SHALL provide appropriate WebXR integration and fallbacks
3. WHEN interactive examples are present THEN the system SHALL display them inline within the article content
4. WHEN managing interactive content THEN the admin SHALL be able to upload and configure interactive examples
5. WHEN loading interactive content THEN the system SHALL implement proper security measures for iframe sandboxing
6. WHEN interactive examples fail to load THEN the system SHALL provide fallback content or error messages
7. WHEN displaying interactive content THEN the system SHALL ensure responsive behavior across different screen sizes

### Requirement 12

**User Story:** As a portfolio visitor, I want to navigate through image carousels easily, so that I can view all related images for a project feature.

#### Acceptance Criteria

1. WHEN image carousels are displayed THEN the system SHALL support touch/swipe gestures on mobile devices
2. WHEN using carousels on desktop THEN the system SHALL provide clickable arrow navigation buttons
3. WHEN viewing carousels THEN the system SHALL show dot indicators for slide position and total count
4. WHEN managing carousel content THEN the admin SHALL be able to upload multiple images and set their order
5. WHEN carousel images load THEN the system SHALL implement smooth transitions between slides
6. WHEN adding image descriptions THEN the admin SHALL be able to set individual descriptions for each carousel slide

### Requirement 20

**User Story:** As a portfolio visitor, I want fast page loading and responsive interactions, so that I have a smooth browsing experience without delays.

#### Acceptance Criteria

1. WHEN loading the projects page THEN the system SHALL respond within 200ms for optimal user experience
2. WHEN querying the database THEN the system SHALL use optimized queries to minimize response time
3. WHEN loading project lists THEN the system SHALL use single queries with joins instead of N+1 query patterns
4. WHEN serving repeated requests THEN the system SHALL implement caching to reduce database load
5. WHEN displaying large datasets THEN the system SHALL use pagination and limit query results
6. WHEN loading media content THEN the system SHALL implement lazy loading and image optimization
7. WHEN database queries exceed 100ms THEN the system SHALL log performance warnings for optimization
8. WHEN optimization conflicts with functionality THEN the system SHALL prioritize working features over performance
9. WHEN loading takes time THEN the system SHALL show progressive loading states and partial content
10. WHEN data loads sequentially THEN the system SHALL display available content immediately and update incrementally
11. WHEN features are temporarily unavailable THEN the system SHALL disable UI elements and show loading indicators

## Requirement 13

**User Story:** As a portfolio visitor, I want to search and sort projects, so that I can quickly find specific projects or browse them in my preferred order.

#### Acceptance Criteria

1. WHEN the projects page loads THEN the system SHALL provide a search input field to find projects by name, description, or content
2. WHEN typing in the search field THEN the system SHALL filter projects in real-time as I type
3. WHEN viewing the projects list THEN the system SHALL provide sort options (by date, alphabetical, popularity)
4. WHEN sorting is applied THEN the system SHALL animate the reordering of projects smoothly
5. WHEN search results are displayed THEN the system SHALL highlight matching text in project previews
6. WHEN no search results are found THEN the system SHALL display an appropriate "no results" message

### Requirement 14

**User Story:** As a portfolio visitor, I want to see related projects and discover new content, so that I can explore more relevant work.

#### Acceptance Criteria

1. WHEN viewing a project's metadata section THEN the system SHALL display "Related Projects" suggestions based on shared tags
2. WHEN related projects are shown THEN the system SHALL limit the display to 3-5 most relevant projects
3. WHEN clicking on a related project THEN the system SHALL navigate to that project's detailed view
4. WHEN no related projects exist THEN the system SHALL hide the related projects section
5. WHEN calculating related projects THEN the system SHALL prioritize projects with the most shared tags

### Requirement 15

**User Story:** As a portfolio visitor, I want smooth loading experiences and clear navigation, so that I understand where I am and what's happening.

#### Acceptance Criteria

1. WHEN content is loading THEN the system SHALL display skeleton screens or loading indicators
2. WHEN navigating between sections THEN the system SHALL show loading states for smooth transitions
3. WHEN viewing a project detail THEN the system SHALL display breadcrumb navigation showing current location
4. WHEN loading fails THEN the system SHALL provide clear error messages with retry options
5. WHEN images or media are loading THEN the system SHALL show progressive loading indicators

### Requirement 16

**User Story:** As a portfolio visitor, I want to see project engagement metrics, so that I can identify popular or noteworthy projects.

#### Acceptance Criteria

1. WHEN projects are displayed THEN the system SHALL show view count for each project
2. WHEN viewing a project THEN the system SHALL track and increment the view count
3. WHEN a user spends time on a project page THEN the system SHALL track time spent for analytics
4. WHEN displaying projects THEN the system SHALL optionally show popularity indicators based on view counts
5. WHEN analytics are collected THEN the system SHALL respect user privacy and provide opt-out options

### Requirement 17

**User Story:** As a portfolio owner, I want advanced content management features, so that I can efficiently organize and control project visibility.

#### Acceptance Criteria

1. WHEN creating projects THEN the system SHALL support draft/published status for content staging
2. WHEN managing projects THEN the system SHALL provide visibility settings (public/private) for each project
3. WHEN working with multiple projects THEN the system SHALL support bulk operations (delete multiple, change tags)
4. WHEN draft projects exist THEN the system SHALL only show them to authenticated admin users
5. WHEN private projects exist THEN the system SHALL hide them from public view but allow admin access

### Requirement 18

**User Story:** As a portfolio owner, I want SEO optimization and social sharing, so that my projects get better visibility and engagement.

#### Acceptance Criteria

1. WHEN projects are accessed THEN the system SHALL generate appropriate meta tags for SEO
2. WHEN projects are shared on social media THEN the system SHALL provide Open Graph and Twitter card metadata
3. WHEN the site is crawled THEN the system SHALL generate and serve an XML sitemap
4. WHEN project URLs are accessed THEN the system SHALL use SEO-friendly URL structures
5. WHEN sharing individual projects THEN the system SHALL include project-specific metadata and preview images

### Requirement 19

**User Story:** As a portfolio visitor, I want to view projects in a timeline format, so that I can see the chronological progression of work.

#### Acceptance Criteria

1. WHEN accessing the projects page THEN the system SHALL provide a timeline view option alongside the grid view
2. WHEN timeline view is selected THEN the system SHALL display projects chronologically by work date
3. WHEN viewing the timeline THEN the system SHALL group projects by time periods (years, months)
4. WHEN timeline entries are displayed THEN the system SHALL show project thumbnails, titles, and brief descriptions
5. WHEN clicking timeline entries THEN the system SHALL open the detailed project view
6. WHEN switching between grid and timeline views THEN the system SHALL maintain current filters and search terms

### Requirement 21

**User Story:** As a portfolio owner, I want AI-assisted content editing capabilities, so that I can efficiently create, improve, and manage project content with intelligent suggestions and automated editing.

#### Acceptance Criteria

1. WHEN accessing the admin settings THEN the system SHALL provide an AI settings page where I can securely store and manage API keys for Anthropic and OpenAI providers
2. WHEN configuring AI settings THEN the system SHALL allow me to set custom system prompts, select specific AI models (Claude 3.5 Sonnet, GPT-4o, etc.), and configure behavior parameters like temperature and max tokens
3. WHEN editing a project THEN the system SHALL provide a chat sidebar with model selection and context-aware AI assistance for content creation and editing
4. WHEN making AI requests THEN the system SHALL include relevant project context (tags, metadata, existing content) along with my custom system prompt
5. WHEN receiving AI responses THEN the system SHALL parse structured responses to automatically update article content, tags, links, images, and other metadata
6. WHEN selecting text portions THEN the system SHALL allow me to make targeted AI edits that only affect the selected content while maintaining context awareness
7. WHEN AI makes changes THEN the system SHALL provide clear indication of what was modified and allow me to review and approve changes before applying them
8. WHEN using AI features THEN the system SHALL handle API failures gracefully and provide meaningful error messages
9. WHEN storing API keys THEN the system SHALL encrypt sensitive data and follow security best practices for credential management
10. WHEN AI processes content THEN the system SHALL maintain conversation history within the editing session for iterative improvements
11. WHEN receiving AI responses THEN the system SHALL expect structured JSON responses with reasoning, changes, confidence levels, and warnings
12. WHEN making content changes THEN the system SHALL provide basic undo/redo functionality during editing sessions
13. WHEN editing text selections THEN the system SHALL provide full article context to AI while only replacing the selected portion
14. WHEN conversation sessions end THEN the system SHALL clear conversation history but preserve permanent version snapshots for later reference
15. WHEN making content changes THEN the system SHALL create automatic version snapshots for permanent history tracking
16. WHEN configuring version settings THEN the system SHALL allow me to set auto-save intervals (30 seconds, 1 minute, 2 minutes, 5 minutes, or disabled)
17. WHEN managing version history THEN the system SHALL allow me to permanently delete specific old snapshots and clear entire project snapshot history
18. WHEN version storage becomes large THEN the system SHALL provide cleanup tools with automatic old version deletion based on retention settings
19. WHEN viewing version history THEN the system SHALL show storage usage, version count, and provide bulk management options
20. WHEN auto-save is enabled THEN the system SHALL create snapshots only when content has actually changed since the last save

### Requirement 22

**User Story:** As a portfolio owner, I want a unified, intuitive project editing experience that resembles the final project view, so that I can efficiently create and edit projects with inline editing and integrated AI assistance.

#### Acceptance Criteria

1. WHEN creating or editing a project THEN the system SHALL use a single unified page for both new and existing projects
2. WHEN viewing the edit interface THEN the system SHALL display the project in a layout that resembles how visitors will see it
3. WHEN editing project metadata THEN the system SHALL allow inline editing of title, description, tags, and other fields directly in the preview
4. WHEN adding tags THEN the system SHALL support comma or semicolon-separated input with instant tag creation and removal via X buttons
5. WHEN uploading media THEN the system SHALL allow clicking on thumbnail areas to upload new images
6. WHEN using the interface THEN the system SHALL display two main sections side-by-side: project edit view and AI assistant panel
7. WHEN viewing the layout THEN the system SHALL center both sections on screen using shadcn/ui card styling with rounded corners
8. WHEN managing publication settings THEN the system SHALL provide visibility controls (Public/Private) in the floating save bar
9. WHEN managing project status THEN the system SHALL use a simplified approach with only visibility settings (removing redundant Draft/Published status)
10. WHEN displaying save status THEN the system SHALL show "last saved time" or "time since last save" near the save button, updating to "Saved" when current
9. WHEN editing content THEN the system SHALL support text selection for targeted AI assistance
11. WHEN creating modular components THEN the system SHALL design reusable components (SmartTagInput, ClickableMediaUpload) that can be extracted for use in other projects
12. WHEN handling media uploads THEN the system SHALL integrate with existing media modal but allow drag-and-drop bypass for direct thumbnail uploads
13. WHEN providing AI assistance THEN the system SHALL never hallucinate content and always preserve user's original meaning and intent
14. WHEN displaying the AI panel THEN the system SHALL use fixed height with floating behavior and include quick action buttons for common tasks

### Requirement 23

**User Story:** As a portfolio owner, I want a rich text editing experience with AI integration, so that I can create professional project content with embedded media, interactive elements, and AI-assisted writing.

#### Acceptance Criteria

1. WHEN editing project content THEN the system SHALL use Novel editor for rich text editing with Notion-like UX
2. WHEN displaying project content THEN the system SHALL render the same content in read-only mode for public viewing
3. WHEN creating content THEN the system SHALL support slash commands for inserting portfolio-specific blocks (/image, /carousel, /interactive, /download)
4. WHEN storing content THEN the system SHALL use JSON format for structured, AI-friendly data storage
5. WHEN using AI assistance THEN the system SHALL work seamlessly with Novel's block-based content structure
6. WHEN inserting media THEN the system SHALL support image carousels, interactive embeds, and download buttons as custom blocks
7. WHEN referencing other projects THEN the system SHALL support internal project links within the rich text content
8. WHEN editing with AI THEN the system SHALL preserve the user's content structure and never hallucinate information
9. WHEN switching between edit and view modes THEN the system SHALL maintain consistent content rendering and styling
10. WHEN saving content THEN the system SHALL store both the JSON structure and any associated media/file references

### Requirement 24

**User Story:** As a portfolio owner, I want to configure AI settings through environment variables and simple interfaces, so that I can manage AI services securely and efficiently.

#### Acceptance Criteria

1. WHEN configuring AI services THEN the system SHALL read API keys from OPENAI_API_KEY and ANTHROPIC_API_KEY environment variables
2. WHEN API keys are missing THEN the system SHALL display clear status indicators showing which providers need configuration
3. WHEN configuring models THEN the system SHALL provide text inputs for comma-separated model IDs (e.g., "gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022")
4. WHEN displaying available models THEN the system SHALL show all configured models from all providers in a unified dropdown
5. WHEN testing AI configuration THEN the system SHALL provide real-time connection testing with actual API validation
6. WHEN API keys are invalid THEN the system SHALL provide actionable error messages with links to provider documentation
7. WHEN no models are configured for a provider THEN the system SHALL hide that provider from the AI assistant
8. WHEN selecting models THEN the system SHALL remember the selection for the current editing session
9. WHEN displaying API key status THEN the system SHALL show masked versions (last 4 characters) for confirmation
10. WHEN managing AI providers THEN the system SHALL use a clean provider abstraction layer for extensibility

### Requirement 25

**User Story:** As a portfolio owner, I want the project editing interface to visually match the public viewing experience, so that I can see exactly how my content will appear to visitors while I'm editing it.

#### Acceptance Criteria

1. WHEN editing a project THEN the system SHALL maintain the same layout, positioning, and visual hierarchy as the public project view
2. WHEN viewing project metadata fields THEN the system SHALL place title, description, tags, date, and other elements in identical positions to the public view
3. WHEN editing content THEN the system SHALL preserve the same spacing, typography, and visual relationships between elements
4. WHEN switching between edit and view modes THEN the system SHALL maintain consistent element placement and styling
5. WHEN adding or modifying content THEN the system SHALL show a true preview of how the content will appear to visitors
6. WHEN implementing editing features THEN the system SHALL never alter the fundamental layout structure that visitors see
7. WHEN displaying editable fields THEN the system SHALL use in-place editing that maintains the original visual design
8. WHEN rendering the editing interface THEN the system SHALL ensure that all visual elements (images, text, spacing) match the public presentation exactly
9. WHEN testing the editing experience THEN the system SHALL verify that the edit view is a pixel-perfect representation of the public view with editing capabilities added
10. WHEN making layout changes THEN the system SHALL update both edit and view modes simultaneously to maintain consistency

### Requirement 27

**User Story:** As a portfolio visitor, I want to choose between different visual themes, so that I can view the portfolio in my preferred aesthetic style.

#### Acceptance Criteria

1. WHEN visiting the portfolio THEN the system SHALL provide a theme selector to switch between light and dark modes
2. WHEN selecting a theme THEN the system SHALL persist the preference across sessions
3. WHEN themes change THEN the system SHALL animate the transition smoothly
4. WHEN using dark theme THEN the system SHALL use appropriate contrast ratios for accessibility
5. WHEN displaying themes THEN the system SHALL maintain consistent branding and visual hierarchy
6. WHEN themes are applied THEN the system SHALL ensure all components support both light and dark variants

### Requirement 28

**User Story:** As a portfolio visitor, I want a comprehensive homepage that showcases the portfolio owner's work and personality, so that I can get a complete overview before diving into specific projects.

#### Acceptance Criteria

1. WHEN visiting the homepage THEN the system SHALL display a hero section with the portfolio owner's name, title, and compelling introduction
2. WHEN viewing the homepage THEN the system SHALL include an about section with professional background and skills
3. WHEN browsing the homepage THEN the system SHALL show a featured projects section with 4-8 highlighted projects
4. WHEN the homepage loads THEN the system SHALL include a contact section with ways to get in touch
5. WHEN navigating the homepage THEN the system SHALL provide smooth scrolling between sections
6. WHEN viewing on mobile THEN the system SHALL adapt all homepage sections for mobile viewing
7. WHEN the homepage displays projects THEN the system SHALL use the same ProjectsSection component as the dedicated projects page
8. WHEN clicking on projects from the homepage THEN the system SHALL open the same detailed project modal as the projects page
9. WHEN the homepage loads THEN the system SHALL provide clear navigation to the full projects page for visitors who want to see all work

### Requirement 29

**User Story:** As a portfolio owner, I want modular, reusable sections that I can customize independently, so that I can maintain consistent functionality while having design flexibility.

#### Acceptance Criteria

1. WHEN building pages THEN the system SHALL use modular section components that can be reused across different pages
2. WHEN displaying projects THEN the system SHALL use a single ProjectsSection component that works on both homepage and dedicated projects page
3. WHEN configuring the projects section THEN the system SHALL support different variants (homepage, full-page, featured) with different behaviors
4. WHEN using the projects section on the homepage THEN the system SHALL limit the number of displayed projects and hide advanced filters
5. WHEN using the projects section on the dedicated page THEN the system SHALL show all projects with full search and filtering capabilities
6. WHEN customizing sections THEN the system SHALL allow different layouts (grid, timeline, carousel) and themes per section
7. WHEN managing content THEN the admin SHALL be able to configure each section independently through the admin interface
8. WHEN sections are updated THEN the system SHALL maintain consistent behavior and styling across all uses of the same component
9. WHEN adding new sections THEN the system SHALL follow the same modular pattern for easy maintenance and reusability

### Requirement 30

**User Story:** As a portfolio owner, I want flexible homepage section management, so that I can customize the homepage layout and content without affecting other pages.

#### Acceptance Criteria

1. WHEN managing the homepage THEN the admin SHALL be able to enable or disable individual sections (hero, about, projects, contact)
2. WHEN configuring the projects section for the homepage THEN the admin SHALL be able to set maximum number of projects to display
3. WHEN customizing homepage sections THEN the admin SHALL be able to choose different themes and layouts for each section
4. WHEN editing section content THEN the admin SHALL have dedicated interfaces for hero text, about content, and contact information
5. WHEN reordering sections THEN the admin SHALL be able to drag and drop sections to change homepage layout
6. WHEN saving homepage changes THEN the system SHALL update the homepage without affecting the dedicated projects page
7. WHEN previewing changes THEN the admin SHALL be able to see homepage changes before publishing them
8. WHEN managing featured projects THEN the admin SHALL be able to select which projects appear in the homepage projects section

### Requirement 31

**User Story:** As a portfolio owner using the admin interface, I want a consistent, professional navigation system across all admin functionality, so that I can efficiently manage my portfolio without confusion or inconsistent interfaces.

#### Acceptance Criteria

1. WHEN accessing any admin page THEN the system SHALL display a consistent left sidebar navigation with collapsible sections
2. WHEN viewing the admin sidebar THEN the system SHALL show organized sections for Overview, Homepage, Projects, AI Assistant, Media Library, and Settings
3. WHEN clicking on sidebar sections THEN the system SHALL expand/collapse drawers showing relevant sub-pages
4. WHEN navigating admin pages THEN the system SHALL highlight the current page and show breadcrumb navigation
5. WHEN using admin pages on mobile THEN the system SHALL collapse the sidebar to a hamburger menu for responsive design
6. WHEN viewing admin pages on desktop THEN the system SHALL provide a toggle to hide/show sidebar for more workspace
7. WHEN using admin forms THEN the system SHALL follow consistent layout patterns with standardized styling and actions
8. WHEN viewing admin tables THEN the system SHALL use consistent table layouts with search, filtering, and action buttons
9. WHEN navigating between admin sections THEN the system SHALL maintain consistent page headers, spacing, and visual hierarchy
10. WHEN accessing existing functionality THEN the system SHALL preserve all current admin features within the new navigation structure
11. WHEN new admin pages are created THEN the system SHALL follow the established admin design language and component standards
12. WHEN using the admin interface THEN the system SHALL provide a professional, cohesive experience across all portfolio management functionality

### Requirement 32

**User Story:** As a search engine crawler and portfolio visitor, I want the portfolio to load with content immediately visible, so that the site is indexable and provides fast initial page loads.

#### Acceptance Criteria

1. WHEN the portfolio homepage loads THEN the system SHALL render the initial content on the server before sending to the browser
2. WHEN search engines crawl the site THEN the system SHALL provide fully rendered HTML with all page content for indexing
3. WHEN individual project pages are accessed THEN the system SHALL server-render the complete project content including metadata
4. WHEN the initial page loads THEN the system SHALL display all content immediately without JavaScript loading delays
5. WHEN server-side rendering occurs THEN the system SHALL include proper meta tags, Open Graph data, and structured data for SEO
6. WHEN the client-side JavaScript loads THEN the system SHALL hydrate the server-rendered content without visual flicker
7. WHEN filtering and search are used THEN the system SHALL enhance the server-rendered content with client-side interactivity
8. WHEN project URLs are shared THEN the system SHALL generate SEO-friendly URLs that work without JavaScript
9. WHEN social media platforms preview links THEN the system SHALL provide appropriate meta tags and preview images
10. WHEN the site is accessed with JavaScript disabled THEN the system SHALL still display basic content and navigation
11. WHEN generating sitemaps THEN the system SHALL include all public pages (homepage, projects, individual projects) with proper priority and change frequency
12. WHEN implementing SSR THEN the system SHALL maintain fast Time to First Byte (TTFB) and Largest Contentful Paint (LCP) metrics THEN the system SHALL provide a theme selector to choose between light and dark themes
2. WHEN selecting dark theme THEN the system SHALL apply a dark color scheme with gradients and translucency effects
3. WHEN switching themes THEN the system SHALL persist the user's preference across sessions
4. WHEN implementing themes THEN the system SHALL ensure all components (projects, modals, navigation) support both themes
5. WHEN using dark theme THEN the system SHALL maintain proper contrast ratios for accessibility
6. WHEN themes are applied THEN the system SHALL use smooth transitions between theme changes
7. WHEN developing new features THEN the system SHALL ensure compatibility with both light and dark themes
8. WHEN displaying media content THEN the system SHALL adapt overlays and backgrounds appropriately for each theme
9. WHEN implementing gradients THEN the system SHALL use tasteful, professional color combinations
10. WHEN using translucency THEN the system SHALL ensure readability and visual hierarchy are maintained

### Requirement 26

**User Story:** As a portfolio owner, I want clear visibility into AI assistant status and connectivity, so that I understand when AI features are available and can troubleshoot any configuration issues.

#### Acceptance Criteria

1. WHEN using the AI assistant panel THEN the system SHALL display a clear status indicator showing AI connectivity state
2. WHEN AI is properly configured and connected THEN the system SHALL show "Online" or "Ready" status with a green indicator
3. WHEN API keys are missing or invalid THEN the system SHALL show "No API Key" or "Invalid Key" status with appropriate messaging
4. WHEN AI services are unreachable THEN the system SHALL show "Offline" or "Connection Error" status with error details
5. WHEN AI settings are updated THEN the system SHALL immediately reflect the new status in the assistant panel
6. WHEN there are configuration issues THEN the system SHALL provide actionable error messages and links to settings
7. WHEN testing AI connectivity THEN the system SHALL provide real-time feedback on connection attempts
8. WHEN AI features are disabled THEN the system SHALL clearly indicate this state and provide guidance to enable them
9. WHEN switching between AI providers THEN the system SHALL update the status indicator to reflect the active provider
10. WHEN API rate limits are exceeded THEN the system SHALL show appropriate status and estimated recovery time