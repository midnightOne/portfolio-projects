/**
 * MCP Test Page
 * 
 * Test page for demonstrating the MCP (Model Context Protocol) navigation tools system.
 */

import React from 'react';
import { MCPProvider } from '@/components/providers/mcp-provider';
import { MCPDemo } from '@/components/mcp/mcp-demo';

export default function MCPTestPage() {
  return (
    <MCPProvider
      onToolExecuted={(execution) => {
        console.log('Tool executed:', execution);
      }}
      onError={(error, toolCall) => {
        console.error('MCP Error:', error, 'Tool:', toolCall);
      }}
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">MCP Navigation Tools Test</h1>
            <p className="text-muted-foreground">
              Test the Model Context Protocol navigation tools system for AI-driven UI control.
            </p>
          </div>
          
          <MCPDemo />
        </div>
      </div>
    </MCPProvider>
  );
}