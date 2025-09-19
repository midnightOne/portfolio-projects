'use client';

import React from 'react';

export default function TestMinimalThemePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Minimal Theme Test</h1>
        
        <div className="space-y-4">
          <p>This is a minimal test to check if the page loads</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-card border rounded-lg">
              <h3 className="font-semibold mb-2">Card Background</h3>
              <p className="text-muted-foreground">This uses card background color</p>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Muted Background</h3>
              <p className="text-muted-foreground">This uses muted background color</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          <h3 className="font-semibold">CSS Custom Properties Test</h3>
          <div className="text-sm font-mono space-y-1">
            <div>Background: <span className="px-2 py-1 bg-background border">bg-background</span></div>
            <div>Card: <span className="px-2 py-1 bg-card border">bg-card</span></div>
            <div>Muted: <span className="px-2 py-1 bg-muted border">bg-muted</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}