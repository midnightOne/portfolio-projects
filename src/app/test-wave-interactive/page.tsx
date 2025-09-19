"use client";

import React, { useState } from 'react';
import { WaveEngine, defaultWaveConfig, type WaveConfiguration } from '@/components/ui/wave-background/wave-engine';

export default function TestWaveInteractive() {
  const [config, setConfig] = useState<WaveConfiguration>(defaultWaveConfig);
  const [cameraInfo, setCameraInfo] = useState<string>('No camera changes yet');

  const handleCameraChange = (cameraConfig: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    zoom: number;
    target: { x: number; y: number; z: number };
  }) => {
    console.log('Camera change:', cameraConfig);
    setCameraInfo(JSON.stringify(cameraConfig, null, 2));
    
    setConfig(prev => ({
      ...prev,
      cameraPosition: cameraConfig.position,
      cameraRotation: cameraConfig.rotation,
      cameraZoom: cameraConfig.zoom,
      cameraTarget: cameraConfig.target
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Interactive Wave Controls Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wave Preview */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Interactive Wave Preview</h2>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-black">
              <WaveEngine
                config={config}
                theme="light"
                width={600}
                height={400}
                interactive={true}
                onCameraChange={handleCameraChange}
              />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p><strong>Left Click + Drag:</strong> Rotate camera</p>
              <p><strong>Middle Click + Drag:</strong> Pan camera</p>
              <p><strong>Scroll Wheel:</strong> Zoom in/out</p>
            </div>
          </div>

          {/* Camera Info */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Camera State</h2>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {cameraInfo}
            </pre>
            
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold">Quick Tests:</h3>
              <button
                onClick={() => setConfig(prev => ({ ...prev, wavesX: Math.random() * 5 + 1 }))}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm mr-2"
              >
                Random Waves X
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, displacementHeight: Math.random() * 2 }))}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm mr-2"
              >
                Random Amplitude
              </button>
              <button
                onClick={() => setConfig(prev => ({ 
                  ...prev, 
                  lightTheme: { 
                    ...prev.lightTheme, 
                    primaryColor: `#${Math.floor(Math.random()*16777215).toString(16)}` 
                  }
                }))}
                className="bg-purple-500 text-white px-3 py-1 rounded text-sm"
              >
                Random Color
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}