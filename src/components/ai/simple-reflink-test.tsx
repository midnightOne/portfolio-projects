"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface ReflinkTestResult {
  hasReflink: boolean;
  reflinkCode: string | null;
  validationResult: any;
  publicAccessResult: any;
  featureAvailability: any;
}

export function SimpleReflinkTest() {
  const searchParams = useSearchParams();
  const [testResult, setTestResult] = useState<ReflinkTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testReflinkFunctionality();
  }, [searchParams]);

  const testReflinkFunctionality = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const reflinkCode = searchParams?.get('ref');
      const hasReflink = Boolean(reflinkCode);

      console.log('Testing reflink functionality:', { hasReflink, reflinkCode });

      let validationResult = null;
      if (hasReflink && reflinkCode) {
        // Test reflink validation
        const validationResponse = await fetch('/api/ai/reflink/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: reflinkCode }),
        });

        if (validationResponse.ok) {
          validationResult = await validationResponse.json();
          console.log('Reflink validation result:', validationResult);
        } else {
          console.error('Reflink validation failed:', validationResponse.status);
        }
      }

      // Test public access
      const publicAccessResponse = await fetch('/api/ai/public-access');
      let publicAccessResult = null;
      if (publicAccessResponse.ok) {
        publicAccessResult = await publicAccessResponse.json();
        console.log('Public access result:', publicAccessResult);
      }

      // Test feature availability
      const accessLevel = validationResult?.valid ? 'premium' : publicAccessResult?.accessLevel || 'no_access';
      const featureResponse = await fetch(`/api/ai/feature-availability?accessLevel=${accessLevel}`);
      let featureAvailability = null;
      if (featureResponse.ok) {
        featureAvailability = await featureResponse.json();
        console.log('Feature availability:', featureAvailability);
      }

      setTestResult({
        hasReflink,
        reflinkCode,
        validationResult,
        publicAccessResult,
        featureAvailability,
      });

    } catch (err) {
      console.error('Test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="text-center">Testing reflink functionality...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded bg-red-50 text-red-700">
        <div className="font-medium">Test Error:</div>
        <div className="text-sm">{error}</div>
      </div>
    );
  }

  if (!testResult) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div>No test results available</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded bg-white">
        <h3 className="font-medium mb-2">Reflink Detection Test Results</h3>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Has Reflink:</span> 
            <span className={testResult.hasReflink ? 'text-green-600' : 'text-gray-600'}>
              {testResult.hasReflink ? 'Yes' : 'No'}
            </span>
          </div>
          
          {testResult.reflinkCode && (
            <div>
              <span className="font-medium">Reflink Code:</span> 
              <code className="bg-gray-100 px-1 rounded">{testResult.reflinkCode}</code>
            </div>
          )}

          {testResult.validationResult && (
            <div>
              <span className="font-medium">Validation Status:</span> 
              <span className={testResult.validationResult.valid ? 'text-green-600' : 'text-red-600'}>
                {testResult.validationResult.valid ? 'Valid' : 'Invalid'}
              </span>
              {testResult.validationResult.reason && (
                <span className="text-gray-600"> ({testResult.validationResult.reason})</span>
              )}
            </div>
          )}

          {testResult.validationResult?.reflink && (
            <div>
              <span className="font-medium">Recipient:</span> 
              <span className="text-blue-600">{testResult.validationResult.reflink.recipientName}</span>
            </div>
          )}

          {testResult.publicAccessResult && (
            <div>
              <span className="font-medium">Public Access Level:</span> 
              <span className="text-purple-600">{testResult.publicAccessResult.accessLevel}</span>
            </div>
          )}

          {testResult.featureAvailability && (
            <div>
              <span className="font-medium">Available Features:</span>
              <div className="ml-4 mt-1 space-y-1">
                <div className={`text-xs ${testResult.featureAvailability.chatInterface ? 'text-green-600' : 'text-gray-400'}`}>
                  • Chat Interface: {testResult.featureAvailability.chatInterface ? 'Enabled' : 'Disabled'}
                </div>
                <div className={`text-xs ${testResult.featureAvailability.voiceAI ? 'text-green-600' : 'text-gray-400'}`}>
                  • Voice AI: {testResult.featureAvailability.voiceAI ? 'Enabled' : 'Disabled'}
                </div>
                <div className={`text-xs ${testResult.featureAvailability.jobAnalysis ? 'text-green-600' : 'text-gray-400'}`}>
                  • Job Analysis: {testResult.featureAvailability.jobAnalysis ? 'Enabled' : 'Disabled'}
                </div>
                <div className={`text-xs ${testResult.featureAvailability.advancedNavigation ? 'text-green-600' : 'text-gray-400'}`}>
                  • Advanced Navigation: {testResult.featureAvailability.advancedNavigation ? 'Enabled' : 'Disabled'}
                </div>
                {testResult.featureAvailability.dailyLimit > 0 && (
                  <div className="text-xs text-gray-600">
                    • Daily Limit: {testResult.featureAvailability.dailyLimit} requests
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={testReflinkFunctionality}
          className="mt-3 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          Refresh Test
        </button>
      </div>

      {testResult.validationResult?.welcomeMessage && (
        <div className="p-3 border rounded bg-green-50 text-green-800">
          <div className="font-medium">Welcome Message:</div>
          <div className="text-sm">{testResult.validationResult.welcomeMessage}</div>
        </div>
      )}

      {testResult.publicAccessResult?.accessMessage && (
        <div className="p-3 border rounded bg-blue-50 text-blue-800">
          <div className="font-medium">{testResult.publicAccessResult.accessMessage.title}</div>
          <div className="text-sm">{testResult.publicAccessResult.accessMessage.description}</div>
        </div>
      )}

      {testResult.validationResult?.reason === 'budget_exhausted' && (
        <div className="p-3 border rounded bg-red-50 text-red-800">
          <div className="font-medium">⚠️ Budget Exhausted</div>
          <div className="text-sm">
            This reflink's budget has been exhausted. All AI features have been revoked.
            The user should contact for budget renewal.
          </div>
        </div>
      )}
    </div>
  );
}