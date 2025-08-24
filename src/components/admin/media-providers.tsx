"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Cloud,
  HardDrive,
  Zap,
  Database,
  Github,
  Settings,
  Check,
  AlertCircle
} from "lucide-react";

interface MediaProvider {
  id: string;
  name: string;
  icon: any;
  description: string;
  status: 'configured' | 'not-configured';
  features: string[];
  configDetails?: {
    apiKey?: string;
    cloudName?: string;
    bucket?: string;
    region?: string;
  };
}

export function MediaProvidersInterface() {
  const [currentProvider, setCurrentProvider] = useState<string>('cloudinary');

  // Mock provider data (in a real app, this would come from an API)
  const providers: MediaProvider[] = [
    {
      id: 'cloudinary',
      name: 'Cloudinary',
      icon: Cloud,
      description: 'Auto-optimization, transformations, global CDN',
      status: 'configured',
      features: ['Auto WebP/AVIF', 'Real-time transforms', '25GB free/month', 'Global CDN'],
      configDetails: {
        cloudName: 'your-cloud-name',
        apiKey: '***************'
      }
    },
    {
      id: 's3',
      name: 'AWS S3',
      icon: HardDrive,
      description: 'Cost-effective storage with CloudFront CDN',
      status: 'not-configured',
      features: ['99.999999999% durability', 'CloudFront CDN', 'Very cost-effective', 'Enterprise scale']
    },
    {
      id: 'vercel',
      name: 'Vercel Blob',
      icon: Zap,
      description: 'Seamless Vercel integration, global edge',
      status: 'not-configured',
      features: ['Vercel integration', 'Global edge', 'Simple setup', '1GB free']
    },
    {
      id: 'supabase',
      name: 'Supabase Storage',
      icon: Database,
      description: 'Database-integrated, auth-aware storage',
      status: 'not-configured',
      features: ['Database integration', 'Row Level Security', 'Auth-aware', '1GB free']
    },
    {
      id: 'github',
      name: 'GitHub + jsDelivr',
      icon: Github,
      description: 'Free CDN for open source projects',
      status: 'not-configured',
      features: ['Completely free', 'Version controlled', 'Global CDN', 'Git workflow']
    }
  ];

  const activeProvider = providers.find(p => p.status === 'configured');

  return (
    <div className="space-y-6">
      {/* Current Active Provider */}
      {activeProvider && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <activeProvider.icon className="h-5 w-5" />
                  Current Active Provider: {activeProvider.name}
                </CardTitle>
                <CardDescription>
                  All media uploads are currently using this provider
                </CardDescription>
              </div>
              <Badge variant="default" className="bg-green-600">
                <Check className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Features</h4>
                <div className="space-y-1">
                  {activeProvider.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
              {activeProvider.configDetails && (
                <div>
                  <h4 className="font-medium mb-2">Configuration</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    {activeProvider.configDetails.cloudName && (
                      <div>Cloud Name: <code className="bg-white px-1 rounded">{activeProvider.configDetails.cloudName}</code></div>
                    )}
                    {activeProvider.configDetails.apiKey && (
                      <div>API Key: <code className="bg-white px-1 rounded">{activeProvider.configDetails.apiKey}</code></div>
                    )}
                    {activeProvider.configDetails.bucket && (
                      <div>Bucket: <code className="bg-white px-1 rounded">{activeProvider.configDetails.bucket}</code></div>
                    )}
                    {activeProvider.configDetails.region && (
                      <div>Region: <code className="bg-white px-1 rounded">{activeProvider.configDetails.region}</code></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Available Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Storage Providers</CardTitle>
          <CardDescription>
            Choose from multiple storage providers based on your needs and budget
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => {
              const Icon = provider.icon;
              const isActive = provider.status === 'configured';
              
              return (
                <div 
                  key={provider.id} 
                  className={`p-4 border rounded-lg transition-colors ${
                    isActive
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon size={20} className={isActive ? 'text-green-600' : 'text-gray-600'} />
                    <div className="flex-1">
                      <h4 className="font-medium">{provider.name}</h4>
                      <Badge variant={isActive ? 'default' : 'secondary'} className="mt-1">
                        {isActive ? 'Active' : 'Available'}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{provider.description}</p>
                  
                  <div className="space-y-1 mb-4">
                    {provider.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-500">
                        <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {isActive ? (
                      <Button size="sm" variant="outline" className="flex-1">
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1">
                        Setup
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Comparison</CardTitle>
          <CardDescription>
            Compare features and pricing across different providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Provider</th>
                  <th className="text-left py-2">Free Tier</th>
                  <th className="text-left py-2">CDN</th>
                  <th className="text-left py-2">Transformations</th>
                  <th className="text-left py-2">Best For</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium">Cloudinary</td>
                  <td className="py-2">25GB/month</td>
                  <td className="py-2">✅ Global</td>
                  <td className="py-2">✅ Real-time</td>
                  <td className="py-2">Image-heavy sites</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">AWS S3</td>
                  <td className="py-2">5GB/month</td>
                  <td className="py-2">✅ CloudFront</td>
                  <td className="py-2">❌ Manual</td>
                  <td className="py-2">Enterprise scale</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Vercel Blob</td>
                  <td className="py-2">1GB/month</td>
                  <td className="py-2">✅ Edge</td>
                  <td className="py-2">❌ None</td>
                  <td className="py-2">Vercel projects</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Supabase</td>
                  <td className="py-2">1GB/month</td>
                  <td className="py-2">✅ Global</td>
                  <td className="py-2">❌ None</td>
                  <td className="py-2">Full-stack apps</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">GitHub</td>
                  <td className="py-2">Unlimited*</td>
                  <td className="py-2">✅ jsDelivr</td>
                  <td className="py-2">❌ None</td>
                  <td className="py-2">Open source</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              * GitHub has repository size limits but no bandwidth limits for public repos
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}