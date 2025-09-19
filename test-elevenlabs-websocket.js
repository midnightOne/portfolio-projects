/**
 * Test ElevenLabs WebSocket Connection
 * 
 * This script tests the ElevenLabs WebSocket connection using the signed URL
 * from our token endpoint to verify the connection works properly.
 */

const https = require('https');
const WebSocket = require('ws');

async function testElevenLabsConnection() {
  try {
    console.log('🔄 Testing ElevenLabs WebSocket connection...');
    
    // Step 1: Get signed URL from our token endpoint
    console.log('📡 Fetching signed URL from token endpoint...');
    
    const tokenData = await new Promise((resolve, reject) => {
      const req = https.request('http://localhost:3001/api/ai/elevenlabs/token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Token endpoint failed: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    console.log('✅ Token data received:', {
      agent_id: tokenData.agent_id,
      has_signed_url: !!tokenData.signed_url,
      expires_at: tokenData.expires_at
    });
    
    if (!tokenData.signed_url) {
      console.log('⚠️  No signed URL available, testing public agent connection...');
      console.log('Agent ID:', tokenData.agent_id);
      return;
    }
    
    // Step 2: Test WebSocket connection
    console.log('🔌 Testing WebSocket connection to ElevenLabs...');
    const ws = new WebSocket(tokenData.signed_url);
    
    let connectionTimeout = setTimeout(() => {
      console.log('❌ Connection timeout after 10 seconds');
      ws.close();
    }, 10000);
    
    ws.on('open', () => {
      clearTimeout(connectionTimeout);
      console.log('✅ WebSocket connection established successfully!');
      console.log('🎉 ElevenLabs integration is working correctly');
      
      // Send a test message
      const testMessage = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: 'Hello, this is a test message'
          }]
        }
      };
      
      ws.send(JSON.stringify(testMessage));
      console.log('📤 Test message sent');
      
      // Close connection after a short delay
      setTimeout(() => {
        ws.close();
        console.log('🔚 Connection closed');
      }, 2000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message.type || 'unknown');
      } catch (error) {
        console.log('📥 Received data:', data.toString().substring(0, 100) + '...');
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(connectionTimeout);
      console.log('❌ WebSocket error:', error.message);
      console.log('🔍 This might indicate an authentication or network issue');
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(connectionTimeout);
      console.log(`🔚 WebSocket closed: ${code} ${reason || 'No reason provided'}`);
      
      if (code === 1000) {
        console.log('✅ Connection closed normally');
      } else {
        console.log('⚠️  Connection closed with error code:', code);
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Stack trace:', error.stack);
  }
}

// Run the test
testElevenLabsConnection();