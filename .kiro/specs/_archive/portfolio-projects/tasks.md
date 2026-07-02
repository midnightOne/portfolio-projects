# Implementation Plan

## Foundation Tasks

- [x] 1. Project Setup and Foundation
  - Initialize Next.js 14 project with TypeScript and App Router
  - Configure Tailwind CSS and shadcn/ui components
  - Set up project structure with proper folder organization
  - Create environment configuration files and templates
  - _Requirements: 4.1, 4.2_

- [x] 2. Database Schema and Models
  - [x] 2.1 Set up configurable database connection with Prisma

    - Configure Prisma ORM with flexible database provider (Supabase/Vercel Postgres)
    - Create database connection utilities with provider switching
    - Set up environment-based database configurations
    - _Requirements: 7.1, 7.2_

  - [x] 2.2 Implement core database schema

    - Create projects, tags, media_items, and relationship tables
    - Implement full-text search setup with tsvector
    - Add database indexes for performance optimization
    - _Requirements: 7.2, 13.1_

  - [x] 2.3 Create TypeScript data models and interfaces

    - Define Project, MediaItem, Tag, and related interfaces
    - Implement validation schemas with Zod
    - Create database seed data for development
    - _Requirements: 7.4_

  - [x] 2.4 Implement database provider abstraction

    - Create database adapter pattern for Supabase/Vercel Postgres switching
    - Implement environment-based provider configuration
    - Add provider-specific connection handling
    - _Requirements: Open source flexibility_

- [x] 3. Authentication and Admin Foundation
  - [x] 3.1 Set up NextAuth.js authentication
    - Configure authentication with username/password
    - Implement session management and middleware
    - Create protected route utilities
    - _Requirements: 6.1, 7.5_

## Iteration 1: Modular Architecture Foundation
**Goal**: Establish modular, reusable component architecture
**User Test**: Can visitors navigate between homepage and projects page?

- [x] 4. Core API Development
  - [x] 4.1 Implement basic projects API endpoints

    - Create GET /api/projects with pagination
    - Implement GET /api/projects/[slug] for individual projects
    - Add basic error handling and validation
    - _Requirements: 7.1, 7.4_

- [X] 5. Modular Component Architecture
  - [x] 5.1 Create reusable ProjectsSection component
    - Extract existing project display logic into configurable ProjectsSection component
    - Implement variant system (homepage, full-page, featured) with different behaviors
    - Add configuration props for layout, features, and theming
    - Ensure component works consistently across different contexts
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

  - [x] 5.2 Build homepage section components
    - Create HeroSection component with configurable content and styling
    - Implement AboutSection with skills display and profile image support
    - Build ContactSection with social links and optional contact form
    - Design SectionRenderer for dynamic section loading and configuration
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

  - [x] 5.3 Implement homepage layout and navigation


    - Create Homepage component that renders configured sections
    - Build navigation between homepage and dedicated projects page
    - Implement smooth scrolling between homepage sections
    - Add responsive design for all homepage sections
    - _Requirements: 28.5, 28.6, 28.7, 28.8, 28.9_

- [x] 6. Basic Project Details
  - [x] 6.1 Create simple project detail view
    - Build basic modal or page for project details
    - Display project title, description, and basic metadata
    - Add close functionality and navigation
    - _Requirements: 3.1, 3.2, 3.13_

- [x] 6.2 Audit and optimize query performance
  - Audit current database query structure and identify bottlenecks
  - Implement query performance monitoring and logging
  - Create performance timeline analysis for page load
  - Optimize queries incrementally without breaking functionality
  - _Requirements: 20.1, 20.2, 20.7, 20.8_

- [x] 6.3 Implement progressive loading strategy
  - Create loading state management system
  - Implement sequential loading with immediate content display
  - Add partial UI disabling during loading states
  - Create skeleton screens and loading animations
  - _Requirements: 20.9, 20.10, 20.11_

- [x] 6.4 Fix modal loading transition stutter
  - Eliminate brief disappearance between loading and content states
  - Implement seamless transition from loading animation to content
  - Ensure modal remains visible throughout the entire loading process
  - Add smooth fade transitions between loading and loaded states
  - _Requirements: 20.9, 15.1_

**🧪 User Testing Checkpoint**: Test basic browsing and project viewing

## Iteration 2: Admin Section Management
**Goal**: Admin can configure homepage and section behavior
**User Test**: Can admin customize homepage layout and project section appearance?

- [x] 7. Enhanced Project Details
  - [x] 7.1 Implement two-column project modal layout
    - Create metadata sidebar with project info
    - Build scrollable main content area
    - Add smooth modal animations and URL routing
    - _Requirements: 3.2, 3.4, 3.15, 3.16, 3.17_

  - [x] 7.2 Add basic media display
    - Implement image display in project content
    - Add basic image descriptions
    - Create responsive media layout
    - _Requirements: 3.6, 3.9, 3.10_
    - **Note**: Advanced media features moved to media-management-system spec

- [ ] 8. Admin Section Management Interface
  - [x] 8.1 Create homepage configuration admin interface





    - Build HomepageEditor component for managing section configuration
    - Implement SectionConfigEditor for individual section customization
    - Add SectionOrderManager for drag-and-drop section reordering
    - Create preview functionality to see changes before publishing
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [x] 8.2 Implement section-specific admin controls





    - Create hero section editor for title, subtitle, and background image
    - Build about section editor for content, skills, and profile image
    - Implement contact section editor for email and social links
    - Add projects section configurator for homepage vs full-page settings
    - _Requirements: 30.8, 29.7, 29.8_

**🧪 User Testing Checkpoint**: Test homepage customization and section management

## Iteration 3: Enhanced Project Experience
**Goal**: Rich project details with media and better UX
**User Test**: Can visitors engage with detailed project content across homepage and projects page?

**🧪 User Testing Checkpoint**: Test detailed project viewing across modular sections

## Iteration 4: Search and Discovery
**Goal**: Visitors can find projects through search and filtering
**User Test**: Can visitors easily find specific projects?

- [ ] 9. Search and Filtering
  - [x] 9.1 Implement real-time search functionality
    - Create search input with debounced API calls
    - Build search API with full-text search
    - Add search result highlighting
    - _Requirements: 13.1, 13.2, 13.5_

  - [x] 9.2 Add tag-based filtering
    - Create tag filter navigation
    - Implement real-time filtering with animations
    - Add multiple tag selection support
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 9.3 Build sorting and view options
    - Add sort options (date, title, popularity)
    - Implement grid/timeline view toggle
    - Create timeline view for chronological browsing
    - _Requirements: 13.3, 19.1, 19.2, 19.3_

  - [x] 9.4 Implement AI-assisted content editing
    - **Note**: AI functionality moved to ai-system spec
    - **Dependencies**: Requires AI System for content editing assistance
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.11, 21.12, 21.13, 21.14_

  - [ ] 9.5 Implement content versioning and snapshot management




    - Implement database-based version control with permanent snapshot storage
    - Add configurable auto-save intervals (30s, 1min, 2min, 5min, or disabled)
    - Create version management interface for viewing, deleting, and restoring snapshots
    - Implement bulk version management and project history clearing
    - Add automatic cleanup tools with retention settings and storage optimization
    - Create version comparison and diff visualization
    - Add smart change detection to avoid unnecessary snapshots
    - Build storage usage analytics and optimization recommendations
    - _Requirements: 21.15, 21.16, 21.17, 21.18, 21.19, 21.20_

  - [ ] 9.6 Enhanced AI personalization (Optional - Future Enhancement)
    - Implement user editing pattern analysis to learn writing style preferences
    - Add automatic style adaptation based on previous project content
    - Create intelligent content suggestions based on user behavior patterns
    - Build writing style consistency recommendations
    - _Requirements: Future enhancement for advanced personalization_

**⚠️ ARCHITECTURE REDESIGN**: Tasks 9.4-9.6 are being replaced with cleaner, modular approach (9.8-9.13).

**SKIP THESE PROBLEMATIC TASKS:**
- ~~9.4 Implement AI-assisted content editing~~ (causes spaghetti code)
- ~~9.5 Implement content versioning~~ (too complex, not essential)
- ~~9.6 Enhanced AI personalization~~ (optional, future enhancement)

**PROCEED WITH REDESIGNED TASKS:**

**NEW ARCHITECTURE TASKS** (Replace problematic 9.4-9.6):

- [x] 9.8 Create unified project editor layout foundation
  - Merge /admin/projects/new and /admin/projects/[id]/edit into single route: /admin/projects/editor/[id?]
  - Implement three-island layout: floating save controls + project edit view (60%) + AI panel (35%)
  - Create responsive layout with proper spacing matching existing "new" page styling
  - Add floating save bar with visibility toggle and save status display
  - Ensure proper industry-standard max-width (1400px) and responsive behavior
  - _Requirements: 22.1, 22.6, 22.7, 22.8, 22.9, 22.10_

- [x] 9.9 Build modular SmartTagInput component
  - Create reusable SmartTagInput with comma/semicolon separation
  - Implement case-insensitive tag matching and duplicate detection with animation
  - Add TAB autocomplete from existing tags following UX standards
  - Create visual tag chips with X-button removal
  - Design for modularity - extractable to separate package later
  - _Requirements: 22.4, 22.11_

- [x] 9.10 Implement ClickableMediaUpload with modal integration
  - Create clickable thumbnail area that opens media picker from media-management-system
  - Add drag-and-drop bypass for direct file upload to thumbnail
  - Integrate with media-management-system APIs and components
  - Handle aspect ratio flexibility within left panel constraints
  - Design as modular component for reuse in other projects
  - _Requirements: 22.5, 22.12, 22.11_
  - **Dependencies**: Requires MediaPickerModal from media-management-system

- [x] 9.11 Build inline editing components
  - Create InlineEditable component for title, description, briefOverview
  - Add text selection detection and handling for AI integration
  - Implement shared ProjectDisplay component for edit/view mode consistency
  - Ensure edit view matches public project view layout and styling
  - Add proper validation and error display inline with fields
  - _Requirements: 22.2, 22.3, 22.9_

- [x] 9.12 Create AI assistant panel (user-centric, no-hallucination)
  - **Note**: AI assistant panel moved to ai-system spec
  - **Dependencies**: Requires AIAssistantPanel component from ai-system
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 22.13, 22.14_

- [x] 9.12-9.13 Rich Content System Integration (MOVED TO RICH-CONTENT-SYSTEM SPEC)
  - **Note**: Tiptap 3.* editor, custom extensions, and content management moved to rich-content-system spec
  - **Dependencies**: TiptapEditorWithAI, TiptapDisplayRenderer, and custom extensions from rich-content-system
  - **Dependencies**: TextSelectionManager and content processing integration from rich-content-system
  - **Dependencies**: AI integration, media integration, and content versioning from rich-content-system
  - _Requirements: 22.2, 22.3, 22.9; AI Architecture Redesign: AIContentEditRequest interface, selection support_

- [x] 9.14 Integrate AI assistant with Tiptap 3.* editor
  - **Note**: AI integration moved to ai-system spec
  - **Dependencies**: Requires AI System's Tiptap integration and content processing
  - **Dependencies**: AI quick actions, model selector, and status indicators from ai-system
  - **Dependencies**: Media-related AI suggestions require media-management-system integration
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 22.13, 22.14; AI Architecture Redesign: Provider abstraction compatibility_

- [X] 9.14.1 Detailed Tiptap 3.* AI Integration Implementation Guide
  **CRITICAL**: This task provides comprehensive implementation details to preserve ALL existing AI functionality
  
  **Phase 1: Remove Novel and Install Tiptap 3.***
  - Uninstall Novel packages: `npm uninstall novel @tiptap/extension-*` (Novel-specific extensions)
  - Install Tiptap 3.* core packages: `@tiptap/core@latest @tiptap/pm@latest @tiptap/react@latest @tiptap/starter-kit@latest`
  - Install additional Tiptap extensions: `@tiptap/extension-placeholder @tiptap/extension-typography @tiptap/extension-link @tiptap/extension-image`
  - Remove Novel-specific files: `src/components/novel/`, `src/styles/novel-editor.css`, `scripts/migrate-articles-to-novel.ts`
  
  **Phase 2: Create TiptapEditorWithAI Component**
  - Replace `NovelEditorWithAI` with `TiptapEditorWithAI` in `enhanced-project-editor.tsx`
  - Preserve existing props interface: `{ content, onChange, onSelectionChange, projectContext, className }`
  - Maintain JSON content structure for AI compatibility (use Tiptap's `editor.getJSON()` and `editor.commands.setContent()`)
  - Preserve text selection detection using Tiptap's `editor.state.selection` API
  - Keep existing AI integration points: `TextSelectionManager`, `AIQuickActions`, `AIPromptInterface`
  
  **Phase 3: Update TextSelectionManager for Tiptap 3.***
  - Replace Novel selection API with Tiptap 3.* selection API in `text-selection-manager.tsx`
  - Update `getSelection()` method to use `editor.state.selection.from/to` and `editor.state.doc.textBetween()`
  - Preserve `setSelection()` method using `editor.commands.setTextSelection({ from, to })`
  - Maintain existing `TextSelection` interface and `TextChange` handling
  - Keep compatibility with existing `AIContentEditRequest.selectedText` structure
  
  **Phase 4: Preserve AI Quick Actions Integration**
  - Ensure `AIQuickActions` component continues to work with Tiptap editor
  - Maintain existing quick action buttons: "Make Professional", "Make Casual", "Suggest Tags"
  - Preserve `ProjectContext` interface and content passing to AI
  - Keep existing `AIQuickActionResult` handling and content application
  - Ensure AI responses are properly applied using Tiptap's `editor.commands.setContent()`
  
  **Phase 5: Maintain AI Prompt Interface**
  - Preserve `AIPromptInterface` component integration with Tiptap editor
  - Keep existing `UnifiedModelSelector` and `AIStatusIndicator` components
  - Maintain conversation history and `ContentSnapshot` functionality
  - Preserve partial text editing: AI can modify selected text or full content
  - Ensure `AIPromptResult` structure remains compatible with existing AI architecture redesign
  
  **Phase 6: Update Display Renderer**
  - Create `TiptapDisplayRenderer` for read-only public project display
  - Ensure it renders the same JSON content structure as the editor
  - Maintain existing styling and layout compatibility
  - Preserve custom extension rendering (InteractiveEmbed, ProjectReference, etc.)
  - **Dependencies**: ImageCarousel rendering handled by media-management-system
  
  **Phase 7: Preserve AI Architecture Redesign Compatibility**
  - Ensure compatibility with environment variable API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY)
  - Maintain `AIContentEditRequest` interface structure from AI architecture redesign
  - Preserve `AIContentEditResponse` handling for both full content and partial updates
  - Keep existing provider abstraction layer integration (OpenAI, Anthropic)
  - Maintain unified model selection dropdown functionality
  
  **Phase 8: Testing and Validation**
  - Test all existing AI functionality: quick actions, custom prompts, text selection editing
  - Verify JSON content structure compatibility between editor and display
  - Ensure no regression in AI response handling and content application
  - Test with both OpenAI and Anthropic providers using existing model configurations
  - Validate that all existing AI settings and status indicators continue to work
  
  **Key Files to Update:**
  - `src/components/admin/enhanced-project-editor.tsx` (replace NovelEditorWithAI import)
  - `src/components/admin/text-selection-manager.tsx` (update selection API)
  - Create new: `src/components/admin/tiptap-editor-with-ai.tsx`
  - Create new: `src/components/tiptap/tiptap-display-renderer.tsx`
  - Update: Any components importing Novel-specific files
  
  **AI Integration Points to Preserve:**
  - Text selection detection and partial editing
  - Full article editing with context
  - AI quick actions integration
  - Custom prompt interface
  - Model selection and status indicators
  - Content snapshot and undo/redo functionality
  - JSON content structure for AI processing
  
  _Requirements: All existing AI functionality must continue to work; AI Architecture Redesign compatibility; Portfolio-projects spec requirements 21.1-21.5, 22.2-22.3, 22.9, 22.13-22.14_

- [x] 9.15-9.18 AI System Integration (MOVED TO AI-SYSTEM SPEC)
  - **Note**: All AI-related tasks moved to ai-system spec for better organization
  - **Dependencies**: AI Settings page, assistant panel, provider abstraction, and status caching from ai-system
  - **Dependencies**: Environment-based API key configuration (OPENAI_API_KEY, ANTHROPIC_API_KEY)
  - **Dependencies**: Unified model selection and connection testing from ai-system
  - _Requirements: 24.1-24.10, Performance optimization_

- [] 9.18 Implement theme system with dark mode (Postponed, needs separate ui-system spec)
  - Create theme provider and context for light/dark theme switching
  - Design dark theme with gradients and translucency effects
  - Implement theme selector component with persistence
  - Update all existing components to support both themes
  - Add smooth transitions between theme changes
  - Ensure accessibility compliance for both themes
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6_

- [x] 9.19 Implement Server-Side Rendering (SSR) for SEO and Employer Crawling Optimization





  - **Core SSR Implementation**:
    - Convert homepage to server-side render all configured sections in their admin-defined order with complete HTML content
    - Implement dynamic section rendering that respects admin configuration (section order, enabled/disabled sections, selected templates)
    - Support multiple section templates (e.g., different project section layouts) with server-side template selection based on configuration
    - Implement server-side rendering for dedicated `/projects` page with full project list and metadata
    - Add server-side rendering for individual project pages at `/projects/[slug]` with complete project content, descriptions, and technical details
    - Ensure all portfolio content (bio, experience, skills, project details) is fully rendered in initial HTML regardless of configuration changes
  - **SEO and Crawling Optimization**:
    - Add comprehensive meta tags, Open Graph data, and JSON-LD structured data for all pages (homepage, projects list, individual projects)
    - Create SEO-friendly URLs that work without JavaScript: `/`, `/projects`, `/projects/[slug]`
    - Generate automated sitemap.xml including homepage, projects page, and all individual project pages
    - Add robots.txt with proper crawling directives and sitemap reference
    - Implement hidden crawler-friendly project index page at `/projects/sitemap` with direct links to all projects
  - **Progressive Enhancement Pattern**:
    - Server-rendered content provides complete portfolio information without JavaScript
    - Client-side interactivity (modals, animations, search) enhances the experience but is not required
    - Ensure proper hydration without content shift or loading flicker
    - AI features (voice assistant, floating UI) initialize after hydration as optional enhancements
  - **Performance and Accessibility**:
    - Optimize Time to First Byte (TTFB) and Largest Contentful Paint (LCP) for all page types
    - Test with JavaScript disabled to verify complete portfolio information is accessible
    - Ensure search engines and employer crawling systems can fully index all content
    - Add proper semantic HTML structure for accessibility and SEO
  - **Dynamic Configuration Support**:
    - Implement server-side homepage configuration loading from database during SSR
    - Support dynamic section ordering: render sections in admin-configured sequence
    - Handle section template selection: render appropriate template variant based on admin choice
    - Support section visibility: only render enabled sections while maintaining SEO structure
    - Implement configuration caching to optimize SSR performance for repeated requests
    - Add fallback configuration handling for cases where admin config is unavailable
    - Ensure configuration changes are reflected in SSR without requiring application restart
  - **Implementation Details**:
    - Use Next.js App Router with server components for initial rendering
    - Implement proper data fetching at build time and request time for dynamic content and configuration
    - Create separate page routes (not just modals) for individual projects to ensure crawlability
    - Add canonical URLs and proper meta descriptions for each page
    - Implement breadcrumb navigation and structured data for better search engine understanding
    - Build configuration-aware SSR that adapts to admin changes while maintaining performance
  - **AI System Integration Considerations**:
    - Ensure SSR pages provide complete content that AI system can reference and navigate to
    - Design server-rendered HTML structure with semantic IDs and classes that AI navigation tools can target
    - Implement proper hydration boundaries so AI features don't interfere with SSR content
    - Add data attributes to key elements (projects, sections) for AI tool targeting without breaking SSR
    - Ensure AI floating interface and voice features initialize after hydration without blocking or shifting content
    - Design URL structure (`/projects/[slug]`) to work with both direct access (SSR) and AI navigation tools
    - Test that AI tool calls (navigateTo, highlightText, openProject) work correctly on SSR-rendered pages
    - Ensure reflink detection and AI access control work properly on server-rendered pages
  - **Future-Proof Architecture**:
    - Design SSR system to handle future section types and templates without code changes
    - Implement extensible section rendering system that supports new content types
    - Build configuration schema that can evolve with new section features
    - Ensure SSR performance remains optimal as configuration complexity grows
    - Design caching strategy that handles frequent configuration changes efficiently
    - Plan for A/B testing of different section templates and configurations
    - Support preview mode for testing configuration changes before publishing
  - **Compatibility Requirements**:
    - SSR content must be fully functional without AI features (for crawlers and users with JS disabled)
    - AI features must enhance SSR content without breaking or replacing core functionality
    - Both systems must share the same URL structure and navigation patterns
    - Server-rendered meta tags and structured data must provide context that AI system can utilize
    - Hydration must not cause layout shifts that interfere with AI interface positioning
  - **Testing Integration**:
    - Test SSR pages work correctly when AI features are disabled
    - Test AI features initialize properly on SSR-rendered content
    - Verify AI navigation tools can interact with server-rendered elements
    - Ensure no conflicts between SSR hydration and AI system initialization
  - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8, 32.9, 32.10, 32.11, 32.12_

- [ ] 9.20 Implement Dynamic Configuration Support for SSR







  - **Homepage Configuration Integration**:
    - Implement server-side loading of homepage configuration during SSR build/request time
    - Support dynamic section ordering: fetch admin-configured section sequence and render accordingly
    - Handle section template selection: load template choice from configuration and render appropriate variant
    - Support section visibility toggles: only render enabled sections while maintaining proper HTML structure
    - Implement configuration validation to ensure SSR doesn't break with invalid admin settings
  - **Performance and Caching**:
    - Implement configuration caching strategy to avoid database queries on every SSR request
    - Add cache invalidation when admin changes homepage configuration
    - Support incremental static regeneration (ISR) for configuration-dependent pages
    - Optimize configuration loading to minimize impact on SSR performance
    - Add fallback configuration handling for edge cases (database unavailable, corrupted config)
  - **Template System Integration**:
    - Design extensible template system that works with SSR and configuration changes
    - Support multiple project section templates (grid, timeline, featured, etc.) with server-side selection
    - Implement template-specific SEO optimization (different structured data for different layouts)
    - Ensure all template variants generate proper semantic HTML for crawlers
    - Add template preview functionality that works with SSR
  - **Configuration Change Handling**:
    - Implement real-time configuration updates without requiring application restart
    - Support preview mode for testing configuration changes before publishing
    - Add configuration versioning to handle rollbacks and A/B testing
    - Ensure configuration changes don't break existing URLs or SEO structure
    - Implement gradual rollout of configuration changes with monitoring
  - **Admin Integration**:
    - Ensure admin configuration changes are immediately reflected in SSR output
    - Add configuration validation that prevents SSR-breaking changes
    - Implement configuration backup and restore functionality
    - Add monitoring and alerting for configuration-related SSR issues
  - _Requirements: Homepage configuration system, SSR performance, admin flexibility_

- [ ] 9.21 Ensure SSR and AI System Integration Compatibility
  - **Shared Architecture Design**:
    - Design HTML structure with semantic IDs and classes that both SSR and AI systems can utilize
    - Implement consistent URL patterns that work for both direct access (SSR) and AI navigation
    - Add data attributes to key elements for AI targeting without affecting SSR performance
    - Ensure server-rendered content provides complete context that AI system can reference
  - **Hydration and Initialization Coordination**:
    - Implement proper hydration boundaries to prevent conflicts between SSR and AI features
    - Design AI system initialization to wait for hydration completion
    - Ensure AI floating interface positioning doesn't cause layout shifts on SSR content
    - Add loading states that work for both SSR content and AI feature initialization
  - **Navigation and Tool Integration**:
    - Test AI navigation tools (navigateTo, openProject, highlightText) work correctly on SSR pages
    - Ensure AI tool calls can target server-rendered elements reliably
    - Verify modal/page dual navigation works for both user interaction and AI commands
    - Test reflink detection and AI access control on server-rendered pages
  - **Performance and Compatibility Testing**:
    - Verify SSR pages load and function completely without AI features enabled
    - Test AI features enhance SSR content without breaking core functionality
    - Ensure no JavaScript errors or conflicts during hydration with AI system present
    - Validate that search engines can crawl content while AI features are present but inactive
  - **Error Handling and Fallbacks**:
    - Implement graceful degradation when AI features fail to initialize on SSR pages
    - Add error boundaries to prevent AI system issues from breaking SSR content
    - Ensure SSR content remains accessible if AI system encounters errors
    - Add monitoring to detect integration issues between SSR and AI systems
  - _Requirements: System integration, compatibility testing, error handling_

- [ ] 9.21 Create Crawler-Friendly Project Architecture
  - **Direct Project Page Routes**:
    - Implement individual project pages at `/projects/[slug]` (not just modals) with complete project content
    - Ensure each project has a dedicated URL that can be crawled and indexed independently
    - Add proper navigation between project pages with previous/next links
    - Create project page layout that includes full project description, technical details, and media
  - **Hidden Crawler Index**:
    - Create `/projects/sitemap` page with comprehensive list of all projects and direct links
    - Include project titles, brief descriptions, and technology tags for crawler context
    - Add last modified dates and project status information
    - Structure as semantic HTML list with proper heading hierarchy
    - Include in robots.txt and sitemap.xml for search engine discovery
  - **SEO-Optimized Project Content**:
    - Ensure project descriptions include relevant keywords and technical terms
    - Add structured data (JSON-LD) for each project with technology stack, completion date, and project type
    - Include proper meta descriptions and Open Graph data for social sharing
    - Add canonical URLs and prevent duplicate content issues between modal and page views
  - **Performance Optimization**:
    - Implement progressive loading for project lists and search results on interactive pages
    - Add skeleton screens and loading states for better UX on client-side features
    - Create intelligent preloading of project data based on user behavior
    - Optimize initial page load with critical content prioritization
    - Add lazy loading for images and non-critical content while ensuring SSR content is complete
  - _Requirements: 20.9, 20.10, 20.11, 5.3, 5.4, SEO optimization, Employer crawling systems_

- [x] 9.21 Centralize hardcoded UI constants (Phase 1: Fix Immediate Problem)
  - Create `src/lib/constants/layout.ts` with centralized layout constants
  - Define max-width presets (default: 80rem, editor: 105rem, admin: 120rem)
  - Create spacing constants (section padding, container margins, component gaps)
  - Replace all hardcoded Tailwind classes with imported constants
  - Add TypeScript types for layout constants to prevent invalid values
  - _Requirements: 4.2 (consistent UI components), 5.1 (responsive design), Technical debt reduction_

- [x] 9.22 Implement unified admin navigation system





  - Install and configure shadcn dashboard-01 and sidebar-07 components
  - Create AdminLayout wrapper with collapsible sidebar and consistent page structure
  - Implement complete admin navigation structure with expandable drawers for all specs
  - Build AdminSidebar with sections: Overview, Homepage, Projects, AI Assistant, Media Library, Settings
  - Create AdminPageLayout component for consistent page headers, breadcrumbs, and content areas
  - Establish admin component standards: AdminForm, AdminTable, AdminActions with consistent styling
  - Migrate all existing admin pages to use new layout while preserving functionality
  - Replace current admin dashboard navigation with new sidebar-based system
  - Ensure responsive behavior: sidebar collapses on mobile, toggle on desktop
  - Add proper breadcrumb navigation and current page highlighting
  - Test all existing admin functionality works within new navigation structure
  - **Dependencies**: Foundation for admin interfaces across all specs (ai-system, media-management, ui-system)
  - _Requirements: Admin design language consistency, professional navigation UX_

- [ ] 9.23 Implement simplified auto-save and status tracking
  - Add auto-save with configurable intervals and change detection
  - Create "last saved" / "time since save" status display
  - Implement simple version history (no complex versioning for now)
  - Remove redundant Draft/Published status - use only Public/Private visibility
  - Add unsaved changes detection and user feedback
  - _Requirements: 22.9, 22.10_



  - Add auto-save with configurable intervals and change detection
  - Create "last saved" / "time since save" status display
  - Implement simple version history (no complex versioning for now)
  - Remove redundant Draft/Published status - use only Public/Private visibility
  - Add unsaved changes detection and user feedback
  - _Requirements: 22.9, 22.10_

**🧪 User Testing Checkpoint**: Test redesigned unified editing interface with integrated AI assistance

- [ ] 9.24 Implement reflink detection and session management for Client-Side AI integration
  - Create reflink detection service to parse URL parameters (e.g., ?ref=abc123)
  - Build reflink validation API endpoint with database lookup and budget checking
  - Implement session storage for reflink context with browser refresh persistence
  - Add public access control settings API for AI feature gating
  - Create ReflinkProvider context for sharing reflink session across components
  - Build conditional AI interface rendering based on access level
  - Add personalized welcome messages and budget status tracking
  - Implement graceful degradation when reflinks expire or budgets are exhausted
  - **Integration**: Foundation for Client-Side AI reflink-based access control
  - **Dependencies**: Requires reflink database schema and validation logic from Client-Side AI spec
  - _Requirements: Client-Side AI Requirements 16, 17_

## External API Integration Points

### APIs This System Provides (for other specs to reference)

```typescript
// For All Systems (Core Data APIs)
"GET /api/projects": "List projects with filtering, search, and pagination";
"GET /api/projects/[slug]": "Get individual project with full content";
"GET /api/projects/[id]": "Get project by ID for editing and management";
"PUT /api/projects/[id]": "Update project content and metadata";
"POST /api/projects": "Create new project";
"DELETE /api/projects/[id]": "Delete project and cleanup dependencies";

// For All Systems (Homepage and Section Management)
"GET /api/homepage/config": "Get homepage configuration and section settings";
"PUT /api/homepage/config": "Update homepage configuration and section order";
"GET /api/sections/[type]": "Get specific section configuration (hero, about, contact)";
"PUT /api/sections/[type]": "Update specific section content and settings";

// For SSR System (Server-Side Rendering Support)
"GET /api/ssr/homepage/config": "Get homepage configuration optimized for SSR with caching";
"GET /api/ssr/sections/all": "Get all section configurations for server-side rendering";
"GET /api/ssr/projects/sitemap": "Get project list optimized for sitemap generation";
"POST /api/ssr/cache/invalidate": "Invalidate SSR cache when configuration changes";

// For Client-Side AI System (Public APIs)
"GET /api/public/projects": "Public project list for visitor AI context";
"GET /api/public/projects/[slug]": "Public project details for AI responses";
"GET /api/public/profile": "Portfolio owner profile for AI context";

// For Client-Side AI System (Reflink Integration)
"POST /api/public/reflink/validate": "Validate reflink codes and get session context";
"GET /api/public/ai/access-settings": "Get current public AI access configuration";
ReflinkProvider: "React context provider for reflink session management";
useReflinkSession: "Hook to access current reflink session context";
usePublicAccessSettings: "Hook to get public AI access configuration";

// For All Systems (Authentication & Authorization)
auth: "NextAuth session validation and user management";
"GET /api/auth/session": "Current user session information";
middleware: "Authentication middleware for protected routes";

// For All Systems (Tags & Metadata)
"GET /api/tags": "Available tags for content tagging and filtering";
"POST /api/tags": "Create new tags";
"GET /api/projects/[id]/analytics": "Project view analytics and statistics";

// Components for UI System Enhancement
ProjectsSection: "Modular, reusable projects display component (configurable for different contexts)";
HeroSection: "Homepage hero section (to be enhanced with AI personalization)";
AboutSection: "About section with skills display (to be enhanced with AI content suggestions)";
ContactSection: "Contact section with social links (to be enhanced with AI interaction)";
```

### APIs This System Requires (from other specs)
```typescript
// From Client-Side AI System (Reflink Integration)
ReflinkManager: "Reflink creation, validation, and budget tracking";
ReflinkSessionManager: "Session lifecycle and access control management";
PublicAccessManager: "Public access settings and messaging";
"POST /api/ai/reflinks/validate": "Server-side reflink validation with budget checking";
"GET /api/ai/public-access/settings": "Current public access configuration";
"POST /api/ai/usage/track": "Track AI usage for budget monitoring";

// From UI System
FloatingAIInterface: "AI interface component with reflink access control";
useUIControl: "Programmatic UI control for conditional AI rendering";
useTheme: "Theme management for consistent AI interface styling";
```
ProjectModal: "Project detail modal (to be enhanced with AI control hooks)";
ProjectGrid: "Project grid layout (to be enhanced with AI navigation)";
ProjectCard: "Individual project card (to be enhanced with AI highlighting)";
NavigationBar: "Main navigation between homepage and projects (to be enhanced with AI control)";

// Admin Components for All Specs
AdminLayout: "Unified admin layout with sidebar navigation (foundation for all admin interfaces)";
AdminSidebar: "Collapsible sidebar with expandable drawers for all admin sections";
AdminPageLayout: "Consistent page wrapper with headers, breadcrumbs, and content areas";
AdminForm: "Standardized form component with consistent styling and validation";
AdminTable: "Consistent table component with search, filtering, and actions";
AdminActions: "Standardized action button patterns for all admin pages";

// Database & Models for All Systems
Project: "Core project data model and validation schemas";
Tag: "Tag data model and relationship management";
User: "User authentication and session management";
```

## External System Dependencies

### Media Management System APIs
```typescript
// Required from media-management-system spec
"POST /api/media/upload": "Upload media files for projects";
"GET /api/media": "List project media with filtering";
"GET /api/media/[id]": "Get media item with optimized URLs";
MediaPickerModal: "Context-aware media selection component";
MediaLibraryButton: "Media library access with unused indicator";
useMediaUpload: "File upload hook with progress tracking";
useProjectMedia: "Project media management hook";
```

### Rich Content System Dependencies
```typescript
// Required from rich-content-system spec
TiptapEditorWithAI: "Main rich text editor with AI integration";
TiptapDisplayRenderer: "Read-only content renderer for public display";
TextSelectionManager: "Text selection management for AI integration";
ContentVersionManager: "Content version history and management";
useRichContent: "Rich content editing and persistence";
useTextSelection: "Text selection management for AI assistance";
useContentVersions: "Content version history management";
```

### AI System Dependencies
```typescript
// Required from ai-system spec
"POST /api/admin/ai/process-content": "AI content processing and enhancement";
"POST /api/admin/ai/quick-action": "AI quick actions for content editing";
AIAssistantPanel: "AI assistance interface for content editing";
AIModelSelector: "Unified model selection dropdown";
AIStatusIndicator: "AI provider connection status display";
useAIConfig: "AI configuration and provider status management";
useAIContentProcessor: "AI content processing and quick actions";
```

### UI System Dependencies
```typescript
// Required from ui-system spec
Button, Modal, Card, Input: "Enhanced shadcn/ui components with AI control hooks";
designTokens: "Centralized colors, spacing, typography, animation tokens";
themeProvider: "Enhanced light/dark theme management with AI coordination";
useTheme: "Theme management with animation coordination";
useUIControl: "UI control hooks for AI navigation integration";
FloatingAIInterface: "Floating AI interface for visitor interactions";
```

## Future AI Enhancements (To Do Later)

**Context**: Based on analysis of Tiptap Pro's AI Agent extension, these features would be valuable for our portfolio system but are not essential for MVP. We can implement our own versions when needed, avoiding paid dependencies.

### Advanced Text Replacement System
- **What**: Implement sophisticated diff-based text replacement similar to Tiptap Pro's `apply_diff` tool
- **Why**: Our current position-based replacement can fail with concurrent edits or complex formatting changes
- **How**: Create a diff algorithm that matches content before/after changes, handles edge cases like overlapping selections
- **When**: If users report issues with AI text replacement accuracy or we need to handle complex multi-paragraph edits
- **Implementation**: `src/lib/ai/advanced-diff-engine.ts` - custom diff matching and application system

### Document Chunking for Large Articles
- **What**: Implement document chunking system similar to Tiptap Pro's `read_first_chunk`, `read_next_chunk`, `read_previous_chunk`
- **Why**: Large portfolio articles (>5000 words) may exceed AI context limits or cause performance issues
- **How**: Split documents into semantic chunks (by headings, paragraphs), maintain context between chunks, process incrementally
- **When**: If users create very long portfolio articles or we hit AI token limits
- **Implementation**: `src/lib/ai/document-chunking.ts` - smart content splitting and context preservation

### AI Task Planning and Multi-Step Edits
- **What**: Implement planning system similar to Tiptap Pro's `plan` and `finish_with_summary` tools
- **Why**: Complex editing tasks (like "restructure this article for better flow") need multi-step planning
- **How**: AI generates step-by-step plan, executes incrementally, provides progress feedback and final summary
- **When**: If users request complex document restructuring or multi-step content improvements
- **Implementation**: `src/lib/ai/task-planner.ts` - break down complex edits into manageable steps

### Interactive AI Conversations
- **What**: Implement conversational AI similar to Tiptap Pro's `ask_user` tool for clarification during edits
- **Why**: AI sometimes needs clarification about user intent, especially for ambiguous requests
- **How**: AI can pause mid-edit to ask questions, user responds, AI continues with better context
- **When**: If users frequently get unsatisfactory AI results due to ambiguous prompts
- **Implementation**: `src/components/admin/ai-conversation-dialog.tsx` - modal for mid-edit AI questions

### Content-Aware Selection Enhancement
- **What**: Improve text selection to understand semantic boundaries (sentences, paragraphs, sections)
- **Why**: Current selection is character-based; semantic selection would improve AI context understanding
- **How**: Analyze document structure, suggest smart selections, expand selections to logical boundaries
- **When**: If users struggle with selecting appropriate text for AI editing
- **Implementation**: `src/lib/ai/smart-selection.ts` - semantic boundary detection and selection expansion

### AI-Powered Content Suggestions
- **What**: Proactive content suggestions based on document analysis (similar to Grammarly)
- **Why**: Instead of manual AI requests, system could suggest improvements automatically
- **How**: Background analysis of content, non-intrusive suggestions for improvements, user can accept/dismiss
- **When**: If users want more automated writing assistance beyond manual prompts
- **Implementation**: `src/components/admin/ai-suggestions-panel.tsx` - floating suggestions with accept/dismiss actions

**Note**: All these features should be implemented as free, open-source alternatives to paid solutions. Priority should be given based on actual user needs and pain points, not feature completeness.

## Iteration 5: Advanced Content Features
**Goal**: Rich media experiences and interactive content
**User Test**: Can visitors engage with advanced project features?

- [x] 10. Advanced Content Features
  - [x] 10.1 Add external links display
    - Create external links components with proper icons and handling
    - Implement link validation and status checking
    - Add responsive link display in project metadata
    - _Requirements: 9.1, 9.2, 9.3_
    - **Note**: Image carousels and download buttons moved to media-management-system spec

- [ ] 11. Interactive Content Support
  - [ ] 11.1 Implement interactive content embedding
    - Add iframe sandboxing for interactive examples
    - Create WebXR integration with fallback handling
    - Implement canvas element support with security
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_

**🧪 User Testing Checkpoint**: Test advanced media and interactive features

## Iteration 6: Content Management and Admin Features
**Goal**: Complete admin experience for content management
**User Test**: Can admin efficiently manage all content types?

- [ ] 12. Complete Admin Interface
  - [ ] 12.1 Implement remaining interactive content features
    - **Dependencies**: InteractiveEmbed and ProjectReference extensions from rich-content-system
    - **Dependencies**: All Tiptap extensions and content management from rich-content-system
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 12.2 Advanced admin features (update existing implementation)
    - Remove redundant Draft/Published status (already simplified to Public/Private visibility)
    - Add bulk operations for project management (select multiple, bulk delete, bulk tag changes)
    - Enhance project visibility controls with better UX
    - Add project duplication functionality
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 13. Project Cross-Referencing
  - [ ] 13.1 Internal project linking
    - Implement project links in article content
    - Add link validation and styling
    - Ensure proper navigation and history handling
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [ ] 13.2 Related projects system
    - Build tag-based project recommendations
    - Create related projects display
    - Add navigation between related projects
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

**🧪 User Testing Checkpoint**: Test complete admin workflow and project relationships

## Iteration 7: Performance and Polish
**Goal**: Optimized, production-ready experience with full SEO support
**User Test**: Is the site fast, accessible, SEO-optimized, and polished?

- [ ] 14. Performance Optimization and SEO
  - [ ] 14.1 Complete SSR implementation and SEO optimization
    - Finalize server-side rendering for all public pages
    - Implement comprehensive meta tag generation and structured data
    - Add automated sitemap generation and robots.txt
    - Optimize Core Web Vitals (LCP, FID, CLS) for search ranking
    - Test SEO implementation with search engine crawlers
    - Validate Open Graph and Twitter Card metadata
    - _Requirements: 28.1-28.12, 18.1-18.5_

  - [ ] 14.2 Implement performance enhancements
    - Add image optimization and lazy loading
    - Implement API response caching
    - Optimize bundle size and loading performance
    - _Requirements: 5.3, 5.4, 5.2, 5.5_

  - [ ] 14.3 Add analytics and monitoring
    - Implement view count tracking
    - Create analytics API endpoints
    - Add Core Web Vitals monitoring
    - _Requirements: 16.1, 16.2, 16.4_

- [ ] 15. UX Enhancements
  - [ ] 15.1 Polish user experience
    - Add skeleton screens and loading states
    - Implement smooth transitions and animations
    - Create breadcrumb navigation
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 15.2 SEO and social optimization
    - Generate dynamic meta tags and Open Graph data
    - Create XML sitemap generation
    - Implement structured data for search engines
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

**🧪 User Testing Checkpoint**: Test performance, accessibility, and overall polish

## Final Phase: Testing, Deployment, and Documentation

- [ ] 16. Comprehensive Testing
  - [ ] 16.1 Write unit tests for components
    - Test core components and functionality
    - Add API endpoint tests
    - Implement integration tests
    - _Requirements: Testing strategy_

  - [ ] 16.2 End-to-end testing
    - Test complete user workflows
    - Verify admin workflows
    - Test responsive behavior across devices
    - _Requirements: 1.3, 2.2, 3.1_

- [ ] 17. Production Deployment
  - [ ] 17.1 Set up Vercel deployment pipeline
    - Configure automatic deployments from GitHub
    - Set up preview deployments for pull requests
    - Configure environment variables for production
    - _Requirements: CI/CD workflow_

  - [ ] 17.2 Production database and services setup
    - Configure production database (Supabase or Vercel Postgres)
    - Set up Cloudinary for production media handling
    - Configure custom domain and SSL
    - _Requirements: Production deployment_

- [ ] 18. Documentation and Open Source
  - [ ] 18.1 Create comprehensive documentation
    - Write detailed README with setup instructions
    - Document API endpoints and usage
    - Create deployment and contribution guides
    - _Requirements: Documentation strategy_

  - [ ] 18.2 Prepare for open source release
    - Add MIT license file
    - Create environment variable templates
    - Set up sample data and development seeds
    - _Requirements: Open source considerations_

**🚀 Final Launch**: Production deployment and public release

## External System Dependencies

### Client-Side AI System Dependencies
```typescript
// Required from client-side-ai spec
FloatingAIAssistant: "Visitor-facing AI chat interface that overlays on portfolio";
AIProjectRecommendations: "AI-powered project suggestions based on visitor interests";
AIContentAnalyzer: "Analyzes visible project content for AI context";
useVisitorAI: "Hook for visitor AI interactions and recommendations";
useAIProjectContext: "Provides project content context to AI features";
```

### Media Management System APIs
```typescript
// Required from media-management-system spec
"POST /api/media/upload": "Upload media files for projects";
"GET /api/media": "List project media with filtering";
"GET /api/media/[id]": "Get media item with optimized URLs";
MediaPickerModal: "Context-aware media selection component";
MediaLibraryButton: "Media library access with unused indicator";
useMediaUpload: "File upload hook with progress tracking";
useProjectMedia: "Project media management hook";
```

### Rich Content System Dependencies
```typescript
// Required from rich-content-system spec
TiptapEditorWithAI: "Main rich text editor with AI integration";
TiptapDisplayRenderer: "Read-only content renderer for public display";
TextSelectionManager: "Text selection management for AI integration";
ContentVersionManager: "Content version history and management";
useRichContent: "Rich content editing and persistence";
useTextSelection: "Text selection management for AI assistance";
useContentVersions: "Content version history management";
```

### AI System Dependencies
```typescript
// Required from ai-system spec
"POST /api/admin/ai/process-content": "AI content processing and enhancement";
"POST /api/admin/ai/quick-action": "AI quick actions for content editing";
AIAssistantPanel: "AI assistance interface for content editing";
AIModelSelector: "Unified model selection dropdown";
AIStatusIndicator: "AI provider connection status display";
useAIConfig: "AI configuration and provider status management";
useAIContentProcessor: "AI content processing and quick actions";
```

### UI System Dependencies
```typescript
// Required from ui-system spec
Button, Modal, Card, Input: "Enhanced shadcn/ui components with AI control hooks";
designTokens: "Centralized colors, spacing, typography, animation tokens";
themeProvider: "Enhanced light/dark theme management with AI coordination";
useTheme: "Theme management with animation coordination";
useUIControl: "UI control hooks for AI navigation integration";
FloatingAIInterface: "Floating AI interface for visitor interactions";
```