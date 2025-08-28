"use client";

import React, { useEffect, useState } from 'react';

interface SessionData {
  reflinkCode?: string;
  reflinkSession?: any;
  publicSession?: any;
  timestamp: string;
}

export function SessionPersistenceTest() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = () => {
    try {
      const reflinkCode = sessionStorage.getItem('ai_reflink_code');
      const reflinkSession = sessionStorage.getItem('ai_reflink_session');
      const publicSession = sessionStorage.getItem('ai_public_session');

      setSessionData({
        reflinkCode: reflinkCode || undefined,
        reflinkSession: reflinkSession ? JSON.parse(reflinkSession) : undefined,
        publicSession: publicSession ? JSON.parse(publicSession) : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem('ai_reflink_code');
    sessionStorage.removeItem('ai_reflink_session');
    sessionStorage.removeItem('ai_public_session');
    loadSessionData();
  };

  const testSessionPersistence = () => {
    // Simulate storing session data
    const testData = {
      accessLevel: 'test',
      sessionStartTime: new Date(),
    };
    sessionStorage.setItem('ai_test_session', JSON.stringify(testData));
    
    // Reload to verify persistence
    setTimeout(() => {
      const stored = sessionStorage.getItem('ai_test_session');
      if (stored) {
        console.log('Session persistence test passed:', JSON.parse(stored));
        alert('Session persistence test passed! Check console for details.');
      } else {
        console.error('Session persistence test failed');
        alert('Session persistence test failed!');
      }
      sessionStorage.removeItem('ai_test_session');
    }, 100);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded bg-white">
        <h3 className="font-medium mb-2">Session Storage Test</h3>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Last Updated:</span> 
            <span className="text-gray-600">{sessionData?.timestamp}</span>
          </div>

          {sessionData?.reflinkCode && (
            <div>
              <span className="font-medium">Stored Reflink Code:</span> 
              <code className="bg-gray-100 px-1 rounded ml-1">{sessionData.reflinkCode}</code>
            </div>
          )}

          {sessionData?.reflinkSession && (
            <div>
              <span className="font-medium">Reflink Session:</span>
              <div className="ml-4 mt-1 text-xs">
                <div>Access Level: {sessionData.reflinkSession.accessLevel}</div>
                <div>Recipient: {sessionData.reflinkSession.personalizedContext?.recipientName}</div>
                <div>Session Start: {new Date(sessionData.reflinkSession.sessionStartTime).toLocaleString()}</div>
              </div>
            </div>
          )}

          {sessionData?.publicSession && (
            <div>
              <span className="font-medium">Public Session:</span>
              <div className="ml-4 mt-1 text-xs">
                <div>Access Level: {sessionData.publicSession.accessLevel}</div>
                <div>Session Start: {new Date(sessionData.publicSession.sessionStartTime).toLocaleString()}</div>
              </div>
            </div>
          )}

          {!sessionData?.reflinkCode && !sessionData?.reflinkSession && !sessionData?.publicSession && (
            <div className="text-gray-500 italic">No session data found</div>
          )}
        </div>

        <div className="mt-3 space-x-2">
          <button 
            onClick={loadSessionData}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Refresh
          </button>
          <button 
            onClick={clearSession}
            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Clear Session
          </button>
          <button 
            onClick={testSessionPersistence}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            Test Persistence
          </button>
        </div>
      </div>

      <div className="p-3 border rounded bg-yellow-50 text-yellow-800">
        <div className="font-medium text-sm">Session Persistence Instructions:</div>
        <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
          <li>Visit a URL with a reflink parameter (e.g., ?ref=test-premium)</li>
          <li>Check that session data appears above</li>
          <li>Refresh the page and verify session data persists</li>
          <li>Navigate to a different page and back to verify persistence</li>
          <li>Use "Clear Session" to reset and test different scenarios</li>
        </ol>
      </div>
    </div>
  );
}