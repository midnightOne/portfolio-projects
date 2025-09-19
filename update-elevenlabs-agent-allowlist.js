/**
 * Update ElevenLabs Agent Allowlist
 * 
 * This script updates the ElevenLabs agent to include localhost in the allowlist
 * to ensure browser connections work properly during development.
 */

const https = require('https');

const ELEVENLABS_API_KEY = ''; //removed and revoked leaked key
const AGENT_ID = '';

async function updateAgentAllowlist() {
  try {
    console.log('🔄 Updating ElevenLabs agent allowlist...');
    
    // First, get the current agent configuration
    console.log('📡 Fetching current agent configuration...');
    
    const currentAgent = await new Promise((resolve, reject) => {
      const req = https.request(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Failed to fetch agent: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    console.log('✅ Current agent configuration retrieved');
    console.log('Current allowlist:', currentAgent.platform_settings.auth.allowlist);
    
    // Update the allowlist to include localhost domains
    const updatedPlatformSettings = {
      ...currentAgent.platform_settings,
      auth: {
        ...currentAgent.platform_settings.auth,
        enable_auth: false, // Keep auth disabled for easier testing
        allowlist: [
          { hostname: 'localhost:3000' },
          { hostname: 'localhost:3001' },
          { hostname: '127.0.0.1:3000' },
          { hostname: '127.0.0.1:3001' }
        ]
      }
    };
    
    // Update the agent
    console.log('🔄 Updating agent with new allowlist...');
    
    const updatePayload = JSON.stringify({
      platform_settings: updatedPlatformSettings
    });
    
    const updateResult = await new Promise((resolve, reject) => {
      const req = https.request(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(updatePayload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Failed to update agent: ${res.statusCode} ${res.statusMessage}\n${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(updatePayload);
      req.end();
    });
    
    console.log('✅ Agent updated successfully!');
    console.log('New allowlist:', updateResult.platform_settings.auth.allowlist);
    console.log('🎉 ElevenLabs agent is now configured for localhost development');
    
  } catch (error) {
    console.error('❌ Failed to update agent:', error.message);
    console.error('🔍 Stack trace:', error.stack);
  }
}

// Run the update
updateAgentAllowlist();