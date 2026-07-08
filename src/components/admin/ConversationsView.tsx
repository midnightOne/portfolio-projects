'use client';

/**
 * Client composition for /admin/ai/conversations: the collapsible analytics +
 * export/cleanup tools bar on top, the three-column browser below. A cleanup
 * bumps `refreshKey` to remount the browser so the list reflects the deletion.
 */

import { useState } from 'react';
import { ConversationAdminTools } from './ConversationAdminTools';
import { ConversationBrowser } from './ConversationBrowser';

export function ConversationsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-4">
      <ConversationAdminTools onDataChanged={() => setRefreshKey((k) => k + 1)} />
      <ConversationBrowser key={refreshKey} />
    </div>
  );
}
