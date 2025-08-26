/**
 * Test Enhanced Components - UI System
 * 
 * Test page for enhanced UI components with AI control hooks.
 * Demonstrates both enhanced and SSR-compatible variants.
 */

"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  EnhancedButton, 
  EnhancedCard, 
  EnhancedCardHeader, 
  EnhancedCardTitle, 
  EnhancedCardContent,
  EnhancedDialog,
  EnhancedDialogContent,
  EnhancedDialogHeader,
  EnhancedDialogTitle,
  EnhancedDialogTrigger,
} from '@/components/ui/enhanced';
import { 
  SSRProjectModal, 
  SSRProjectGrid, 
  SSRNavigationBar 
} from '@/components/ui/enhanced/ssr-variants';
import { Badge } from '@/components/ui/badge';
import { useUIControl } from '@/lib/ui/ui-control-hooks';
import type { NavigationCommand, HighlightOptions } from '@/lib/ui/types';

// Mock data for testing
const mockProject = {
  id: '1',
  title: 'Test Project',
  slug: 'test-project',
  description: 'A test project for enhanced components',
  briefOverview: 'Testing enhanced UI components with AI capabilities',
  workDate: new Date(),
  viewCount: 42,
  status: 'PUBLISHED' as const,
  visibility: 'PUBLIC' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [
    { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
    { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  ],
  mediaItems: [],
  externalLinks: [],
  downloadableFiles: [],
  interactiveExamples: [],
  carousels: [],
  _count: { mediaItems: 0, downloadableFiles: 0 },
  metadataImage: null,
  thumbnailImage: null,
  articleContent: null,
};

const mockProjects = [mockProject];

const mockTags = [
  { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
  { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  { id: '3', name: 'Next.js', color: '#000000', createdAt: new Date() },
  { id: '4', name: 'UI/UX', color: '#FF6B6B', createdAt: new Date() },
];

export default function TestEnhancedComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'title' | 'popularity'>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid');
  const [aiEnabled, setAiEnabled] = useState(false);
  
  const { navigate, highlight } = useUIControl();

  // AI command handlers
  const handleAINavigate = (command: NavigationCommand) => {
    console.log('AI Navigation Command:', command);
    navigate(command);
  };

  const handleAIHighlight = (target: string, options: HighlightOptions) => {
    console.log('AI Highlight Command:', target, options);
  };

  const handleProjectClick = (slug: string) => {
    console.log('Project clicked:', slug);
    setProjectModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Enhanced Components Test</h1>
              <p className="text-muted-foreground mt-2">
                Testing enhanced UI components with AI control hooks
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={aiEnabled ? 'default' : 'outline'}>
                AI {aiEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <EnhancedButton
                onClick={() => setAiEnabled(!aiEnabled)}
                aiControlEnabled={aiEnabled}
                aiId="toggle-ai"
                onAINavigate={handleAINavigate}
              >
                Toggle AI
              </EnhancedButton>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Enhanced Button Tests */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Enhanced Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <EnhancedButton
              variant="default"
              aiControlEnabled={aiEnabled}
              aiId="button-default"
              onAINavigate={handleAINavigate}
            >
              Default Button
            </EnhancedButton>
            <EnhancedButton
              variant="outline"
              aiControlEnabled={aiEnabled}
              aiId="button-outline"
              onAINavigate={handleAINavigate}
            >
              Outline Button
            </EnhancedButton>
            <EnhancedButton
              variant="ghost"
              aiControlEnabled={aiEnabled}
              aiId="button-ghost"
              onAINavigate={handleAINavigate}
            >
              Ghost Button
            </EnhancedButton>
            <EnhancedButton
              variant="destructive"
              aiControlEnabled={aiEnabled}
              aiId="button-destructive"
              onAINavigate={handleAINavigate}
            >
              Destructive Button
            </EnhancedButton>
          </div>
        </section>

        {/* Enhanced Card Tests */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Enhanced Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EnhancedCard
              aiControlEnabled={aiEnabled}
              aiId="card-1"
              onAINavigate={handleAINavigate}
              onAIHighlight={handleAIHighlight}
              highlightable={true}
            >
              <EnhancedCardHeader aiId="card-1-header">
                <EnhancedCardTitle aiId="card-1-title">
                  Enhanced Card 1
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent aiId="card-1-content">
                <p>This is an enhanced card with AI control capabilities.</p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard
              aiControlEnabled={aiEnabled}
              aiId="card-2"
              onAINavigate={handleAINavigate}
              onAIHighlight={handleAIHighlight}
              highlightable={true}
            >
              <EnhancedCardHeader aiId="card-2-header">
                <EnhancedCardTitle aiId="card-2-title">
                  Enhanced Card 2
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent aiId="card-2-content">
                <p>Another enhanced card for testing AI interactions.</p>
              </EnhancedCardContent>
            </EnhancedCard>

            <EnhancedCard
              aiControlEnabled={aiEnabled}
              aiId="card-3"
              onAINavigate={handleAINavigate}
              onAIHighlight={handleAIHighlight}
              highlightable={true}
            >
              <EnhancedCardHeader aiId="card-3-header">
                <EnhancedCardTitle aiId="card-3-title">
                  Enhanced Card 3
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent aiId="card-3-content">
                <p>Third enhanced card with highlighting capabilities.</p>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </section>

        {/* Enhanced Dialog Test */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Enhanced Dialog</h2>
          <EnhancedDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <EnhancedDialogTrigger asChild>
              <EnhancedButton
                aiControlEnabled={aiEnabled}
                aiId="dialog-trigger"
                onAINavigate={handleAINavigate}
              >
                Open Enhanced Dialog
              </EnhancedButton>
            </EnhancedDialogTrigger>
            <EnhancedDialogContent
              aiControlEnabled={aiEnabled}
              aiId="dialog-content"
              onAINavigate={handleAINavigate}
              animated={true}
              animationType="scale"
            >
              <EnhancedDialogHeader aiId="dialog-header">
                <EnhancedDialogTitle aiId="dialog-title">
                  Enhanced Dialog
                </EnhancedDialogTitle>
              </EnhancedDialogHeader>
              <div className="py-4">
                <p>This is an enhanced dialog with AI control capabilities and smooth animations.</p>
              </div>
            </EnhancedDialogContent>
          </EnhancedDialog>
        </section>

        {/* SSR Navigation Bar Test */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">SSR Navigation Bar</h2>
          <SSRNavigationBar
            tags={mockTags}
            selectedTags={selectedTags}
            onTagSelect={setSelectedTags}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            variant="section"
            enableClientFeatures={true}
            aiEnabled={aiEnabled}
            aiControlEnabled={aiEnabled}
            aiId="navigation-bar"
            onAINavigate={handleAINavigate}
            onAIHighlight={handleAIHighlight}
          />
        </section>

        {/* SSR Project Grid Test */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">SSR Project Grid</h2>
          <SSRProjectGrid
            projects={mockProjects}
            loading={false}
            onProjectClick={handleProjectClick}
            enableClientFeatures={true}
            aiEnabled={aiEnabled}
            aiControlEnabled={aiEnabled}
            aiId="project-grid"
            onAINavigate={handleAINavigate}
            onAIHighlight={handleAIHighlight}
          />
        </section>

        {/* AI Control Test Section */}
        {aiEnabled && (
          <section>
            <h2 className="text-2xl font-semibold mb-6">AI Control Test</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EnhancedCard
                aiControlEnabled={true}
                aiId="ai-test-card"
                onAINavigate={handleAINavigate}
                onAIHighlight={handleAIHighlight}
                highlightable={true}
              >
                <EnhancedCardHeader>
                  <EnhancedCardTitle>AI Control Test</EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <p className="mb-4">Test AI control capabilities:</p>
                  <div className="space-y-2">
                    <EnhancedButton
                      size="sm"
                      variant="outline"
                      onClick={() => highlight('ai-test-card', {
                        type: 'spotlight',
                        duration: 'timed',
                        timing: 3000,
                        intensity: 'medium'
                      })}
                    >
                      Highlight This Card
                    </EnhancedButton>
                    <EnhancedButton
                      size="sm"
                      variant="outline"
                      onClick={() => navigate({
                        action: 'scroll',
                        target: '#enhanced-components-test',
                      })}
                    >
                      Scroll to Top
                    </EnhancedButton>
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>

              <EnhancedCard>
                <EnhancedCardHeader>
                  <EnhancedCardTitle>AI Status</EnhancedCardTitle>
                </EnhancedCardHeader>
                <EnhancedCardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>AI Control:</span>
                      <Badge variant={aiEnabled ? 'default' : 'secondary'}>
                        {aiEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Components:</span>
                      <span>Enhanced</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Animations:</span>
                      <span>Active</span>
                    </div>
                  </div>
                </EnhancedCardContent>
              </EnhancedCard>
            </div>
          </section>
        )}
      </div>

      {/* SSR Project Modal Test */}
      <SSRProjectModal
        project={mockProject}
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        enableClientFeatures={true}
        aiEnabled={aiEnabled}
        aiControlEnabled={aiEnabled}
        aiId="project-modal"
        onAINavigate={handleAINavigate}
        onAIHighlight={handleAIHighlight}
      />
    </div>
  );
}