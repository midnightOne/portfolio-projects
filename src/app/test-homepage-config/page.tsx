import { HomepageEditor } from '@/components/admin/homepage-editor';

export default function TestHomepageConfigPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Test Page:</strong> This is a test page for the homepage configuration interface.
          In production, this would be behind authentication at /admin/homepage.
        </p>
      </div>
      <HomepageEditor />
    </div>
  );
}