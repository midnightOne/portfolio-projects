import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

// The AI provider chain (pill, dev panels) mounts ONCE in the root layout
// since 7.7 — a live session survives navigating away from this page.
export default function Home() {
  return (
    <div className="min-h-screen">
      <MainNavigation />
      <Homepage />
    </div>
  );
}
