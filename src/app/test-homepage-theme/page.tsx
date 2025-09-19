import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

export default function TestHomepageTheme() {
  return (
    <div className="min-h-screen">
      <MainNavigation />
      <div className="p-4 bg-muted/50 border-b">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Homepage with Theme Toggle</h1>
          <p className="text-muted-foreground">
            The theme toggle is now available in the navigation bar. 
            Click the sun/moon icon to switch between light and dark themes.
          </p>
        </div>
      </div>
      <Homepage />
    </div>
  );
}