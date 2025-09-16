"use client";

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function TestSimpleWave() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Simple scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(800, 600);
    renderer.setClearColor(0x000000);
    mountRef.current.appendChild(renderer.domElement);

    // Simple animated material
    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 }
      },
      vertexShader: `
        uniform float u_time;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z = sin(pos.x * 2.0 + u_time) * 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        varying vec2 vUv;
        
        void main() {
          float r = sin(u_time) * 0.5 + 0.5;
          float g = sin(u_time + 2.0) * 0.5 + 0.5;
          float b = sin(u_time + 4.0) * 0.5 + 0.5;
          gl_FragColor = vec4(r, g, b, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    camera.position.z = 5;

    let startTime = Date.now();

    function animate() {
      const elapsed = (Date.now() - startTime) / 1000;
      material.uniforms.u_time.value = elapsed;
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple Wave Test</h1>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Basic Animated Shader</h2>
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
            <div ref={mountRef} />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            This should show a colorful animated plane with wave deformation.
            If you see animation here but not in the main wave component, 
            the issue is with the complex wave shader.
          </p>
        </div>
      </div>
    </div>
  );
}