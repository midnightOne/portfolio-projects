import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

export default function Home() {
  return (
    <div className="min-h-screen">
      <MainNavigation />
      <Homepage />
    </div>
  );
}