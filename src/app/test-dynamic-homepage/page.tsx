import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

export default function TestDynamicHomepage() {
  return (
    <div className="min-h-screen">
      <MainNavigation />
      <div className="bg-yellow-50 border-b border-yellow-200 p-4">
        <div className="container mx-auto">
          <p className="text-sm text-yellow-800">
            <strong>Dynamic Configuration Test:</strong> This page demonstrates the homepage loading its configuration dynamically from the API. 
            The sections should be reordered (Contact first, then Hero, Projects, About) and have different content than the default.
          </p>
        </div>
      </div>
      <Homepage />
    </div>
  );
}