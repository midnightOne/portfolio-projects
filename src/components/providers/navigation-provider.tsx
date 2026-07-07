'use client';

import { useEffect } from 'react';

/**
 * NavigationProvider - Initializes client-side navigation tools
 * 
 * This component ensures that UIManager and UINavigationTools are
 * properly initialized when the app loads.
 */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize navigation systems
    const initializeNavigation = async () => {
      try {
        // Initialize UIManager
        const { UIManager } = await import('@/lib/navigation/UIManager');
        const uiManager = UIManager.getInstance();
        uiManager.initialize();
        
        // Initialize UINavigationTools
        const { uiNavigationTools } = await import('@/lib/ai/tools/client-tools');
        
        // Expose globally for debugging and integration tests
        if (typeof window !== 'undefined') {
          const uiManagerInstance = uiManager;
          (window as any).UIManager = {
            getInstance: () => uiManagerInstance,
            getSemanticIDRegistry: () => uiManagerInstance.getSemanticIDRegistry(),
            executeIntent: (args: any, sessionId?: string) => uiManagerInstance.executeIntent(args, sessionId),
            describe: () => uiManagerInstance.describe(),
            resolveSemanticID: (id: string) => uiManagerInstance.resolveSemanticID(id),
            validateSemanticID: (id: string) => uiManagerInstance.validateSemanticID(id)
          };
          (window as any).UINavigationTools = {
            getInstance: () => uiNavigationTools
          };
        }
        
        console.log('✅ Navigation systems initialized');
      } catch (error) {
        console.error('❌ Failed to initialize navigation systems:', error);
      }
    };

    initializeNavigation();
  }, []);

  return <>{children}</>;
}