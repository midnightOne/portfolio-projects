"use client";

import React, { Suspense } from 'react';
import { AIInterfaceWrapper } from '@/components/ai/ai-interface-wrapper';

function TestAIInterfaceContent() {
  const handleSettingsClick = () => {
    console.log('Settings clicked');
    alert('Settings panel would open here');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Page content to test positioning */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8">
            AI Interface Test Page
          </h1>
          
          <div className="prose prose-lg mx-auto mb-16">
            <p>
              This page is for testing the new pill-shaped floating AI interface with real voice integration
              and reflink-based access control. The interface should:
            </p>
            
            <ul>
              <li>Start in the center (hero position) when at the top of the page</li>
              <li>Move to the bottom (pinned position) when scrolling down</li>
              <li>Show different features based on access level (no_access, basic, limited, premium)</li>
              <li>Integrate with real OpenAI Realtime API and ElevenLabs Conversational AI</li>
              <li>Support tool execution with system-wide and per-reflink controls</li>
              <li>Display personalized welcome messages for reflink holders</li>
              <li>Show budget status and conversation ID for admin monitoring</li>
            </ul>

            <h2>Testing Instructions</h2>
            <ol>
              <li>Try accessing without a reflink (should show basic or no access)</li>
              <li>Try accessing with a valid reflink: <code>?ref=test-reflink</code></li>
              <li>Test voice input (microphone button)</li>
              <li>Test text input</li>
              <li>Test quick actions</li>
              <li>Test scrolling behavior (position changes)</li>
              <li>Test settings button</li>
            </ol>

            <h2>Access Levels</h2>
            <ul>
              <li><strong>No Access:</strong> Interface hidden completely</li>
              <li><strong>Basic:</strong> Text chat only, limited features</li>
              <li><strong>Limited:</strong> Text + basic voice, standard navigation</li>
              <li><strong>Premium (Reflink):</strong> Full interface with voice AI, job analysis, advanced navigation</li>
            </ul>

            <h2>Voice Providers</h2>
            <p>
              The interface supports switching between OpenAI Realtime API and ElevenLabs Conversational AI.
              Premium users can see the active provider indicator and may have provider-specific configurations.
            </p>

            <h2>Tool System Integration</h2>
            <p>
              The interface integrates with the unified tool system, supporting both client-side navigation tools
              and server-side context loading tools. Tool availability can be controlled system-wide or per-reflink.
            </p>

            <div className="bg-muted p-4 rounded-lg mt-8">
              <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
              <p className="text-sm text-muted-foreground">
                Open browser console to see debug logs for voice connections, tool calls, and conversation events.
                The conversation ID displayed in the interface can be used for admin monitoring in separate browser windows.
              </p>
            </div>
          </div>

          {/* Add some content to test scrolling */}
          <div className="space-y-8">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="bg-card p-6 rounded-lg border">
                <h3 className="text-xl font-semibold mb-4">Test Section {i + 1}</h3>
                <p className="text-muted-foreground">
                  This is test content to create a scrollable page. The AI interface should move from
                  the center position to the bottom pinned position as you scroll down. Lorem ipsum dolor
                  sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                  dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                  nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Interface */}
      <AIInterfaceWrapper 
        defaultProvider="openai"
        onSettingsClick={handleSettingsClick}
      />
    </div>
  );
}

export default function TestAIInterfacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading AI Interface...</div>}>
      <TestAIInterfaceContent />
    </Suspense>
  );
}