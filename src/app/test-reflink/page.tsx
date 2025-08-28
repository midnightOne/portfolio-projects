import { SimpleReflinkTest } from '@/components/ai/simple-reflink-test';
import { SessionPersistenceTest } from '@/components/ai/session-persistence-test';
import { BudgetDrainingTest } from '@/components/ai/budget-draining-test';
import { MainNavigation } from '@/components/layout/main-navigation';

export default function TestReflinkPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainNavigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Reflink Detection Test</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Test the reflink detection and session management functionality.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Current Status</h2>
              <SimpleReflinkTest />
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Test URLs</h2>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="font-medium">No Reflink (Public Access)</div>
                  <a 
                    href="/test-reflink" 
                    className="text-blue-600 hover:underline"
                  >
                    /test-reflink
                  </a>
                </div>
                
                <div className="p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="font-medium">With Valid Reflink</div>
                  <a 
                    href="/test-reflink?ref=test-premium" 
                    className="text-blue-600 hover:underline"
                  >
                    /test-reflink?ref=test-premium
                  </a>
                </div>
                
                <div className="p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="font-medium">With Invalid Reflink</div>
                  <a 
                    href="/test-reflink?ref=invalid-code" 
                    className="text-blue-600 hover:underline"
                  >
                    /test-reflink?ref=invalid-code
                  </a>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  How to Test:
                </h3>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Click the test URLs above to see different access levels</li>
                  <li>Check the status indicator for feature availability</li>
                  <li>Refresh the page to test session persistence</li>
                  <li>Open browser dev tools to see console logs</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Budget Draining Test</h2>
              <BudgetDrainingTest />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Session Persistence Test</h2>
              <SessionPersistenceTest />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}