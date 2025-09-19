import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AIInterfaceWrapper } from '@/components/ai/ai-interface-wrapper';

export default function Home() {
  return (
    <div className="min-h-screen">
      <MainNavigation />
      <Homepage />
      <AIInterfaceWrapper defaultProvider="openai" />
    </div>
  );
}