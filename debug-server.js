#!/usr/bin/env node

// Simple debug server script for Next.js
// This bypasses some of the Turbopack debugging issues

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Next.js in debug mode...');

const nextBin = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

const server = spawn('node', [
  '--inspect=9229',
  '--enable-source-maps',
  nextBin,
  'dev'
], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    // Force webpack instead of Turbopack for better debugging
    NEXT_PRIVATE_SKIP_TURBOPACK: '1'
  }
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});