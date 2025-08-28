/**
 * Content Sources Admin Page
 * Admin interface for managing AI content sources
 */

import { Metadata } from 'next';
import { ContentSourceManager } from '@/components/admin/content-source-manager';

export const metadata: Metadata = {
  title: 'Content Sources - AI Admin',
  description: 'Manage AI content sources and their configurations',
};

export default function ContentSourcesPage() {
  return (
    <div className="container mx-auto py-6">
      <ContentSourceManager />
    </div>
  );
}