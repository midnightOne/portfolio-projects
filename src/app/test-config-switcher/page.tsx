"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Settings } from 'lucide-react';

export default function TestConfigSwitcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<number>(0);
  const [totalConfigs, setTotalConfigs] = useState<number>(3);
  const [message, setMessage] = useState<string>('');

  const switchConfiguration = async () => {
    try {
      setIsLoading(true);
      setMessage('');
      
      const response = await fetch('/api/homepage-config-public/switch', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentConfig(data.data.currentIndex);
        setTotalConfigs(data.data.totalConfigs);
        setMessage(data.data.message);
      } else {
        setMessage('Failed to switch configuration');
      }
    } catch (error) {
      console.error('Error switching configuration:', error);
      setMessage('Error switching configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const openHomepage = () => {
    window.open('/', '_blank');
  };

  const openTestPage = () => {
    window.open('/test-dynamic-homepage', '_blank');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Homepage Configuration Switcher</h1>
        <p className="text-muted-foreground">
          Test dynamic homepage configuration changes. Switch between different configurations 
          and see the changes reflected on the homepage.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Current Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className="mb-2">
                  Configuration {currentConfig + 1} of {totalConfigs}
                </Badge>
                {message && (
                  <p className="text-sm text-muted-foreground">{message}</p>
                )}
              </div>
              
              <Button
                onClick={switchConfiguration}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Switch Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Test Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={openHomepage}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Homepage
              </Button>
              
              <Button
                variant="outline"
                onClick={openTestPage}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Test Page
              </Button>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>
                <strong>Homepage (/):</strong> The main homepage that loads configuration dynamically
              </p>
              <p>
                <strong>Test Page (/test-dynamic-homepage):</strong> Same as homepage but with a banner explaining the test
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Descriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Available Configurations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 border rounded-lg">
                <Badge variant="outline" className="mb-2">Configuration 1</Badge>
                <p className="text-sm">
                  <strong>Default Order:</strong> Hero → About → Projects → Contact
                </p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <Badge variant="outline" className="mb-2">Configuration 2</Badge>
                <p className="text-sm">
                  <strong>Reversed Order:</strong> Contact → Projects → About → Hero
                </p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <Badge variant="outline" className="mb-2">Configuration 3</Badge>
                <p className="text-sm">
                  <strong>Minimal Layout:</strong> Only Hero and Projects (About and Contact disabled)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click "Switch Configuration" to change the homepage layout</li>
              <li>Open the homepage in a new tab to see the changes</li>
              <li>Refresh the homepage to see the new configuration load</li>
              <li>Try switching between different configurations and observe the changes</li>
              <li>Notice how sections are reordered, disabled, or have different content</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}