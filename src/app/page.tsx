import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AIInterfaceWrapper } from '@/components/ai/ai-interface-wrapper';

export default async function Home() {
  // Dev-only fake-mic drill affordance (owner, 2026-07-07): admin-gated so the
  // real portfolio UI state (routes/projects/sections) can be exercised by the
  // same C0 driver used in /admin/ai/voice-debug — never shown to a visitor.
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
    <div className="min-h-screen">
      <MainNavigation />
      <Homepage />
      <AIInterfaceWrapper defaultProvider="openai" isAdmin={isAdmin} />
    </div>
  );
}
