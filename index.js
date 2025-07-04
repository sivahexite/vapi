console.log('Server script started');

const dotenvResult = require('dotenv').config();
if (dotenvResult.error) {
  console.error('❌ Error loading .env file:', dotenvResult.error);
} else {
  console.log('✅ .env file loaded');
}

const WebSocket = require('ws');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const SERVER_PORT = process.env.PORT || 8766;

if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) {
  console.error('❌ Missing VAPI_API_KEY or VAPI_ASSISTANT_ID in .env');
  process.exit(1);
}

let telecmiSocket = null;
let vapiSocket = null;

// 🔄 Create a new Vapi call and get WebSocket URL
async function getVapiWebSocketUrl() {
  try {
    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistant: { assistantId: VAPI_ASSISTANT_ID },
        transport: { provider: 'vapi.websocket' }
      })
    });

    const data = await res.json();

    if (!data?.transport?.websocketCallUrl) {
      console.error('❌ Failed to get websocketCallUrl from Vapi:', data);
      return null;
    }

    console.log('🔗 Received Vapi websocketCallUrl');
    return data.transport.websocketCallUrl;
  } catch (error) {
    console.error('❌ Error creating Vapi call:', error);
    return null;
  }
}

// WebSocket Server for TeleCMI
const server = new WebSocket.Server({ port: SERVER_PORT });

server.on('connection', async (ws) => {
  console.log('✅ TeleCMI (or local client) connected');
  telecmiSocket = ws;

  const vapiWsUrl = await getVapiWebSocketUrl();
  if (!vapiWsUrl) {
    ws.close();
    return;
  }

  vapiSocket = new WebSocket(vapiWsUrl, {
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`
    }
  });

  vapiSocket.on('open', () => {
    console.log('🟢 Connected to Vapi');
  });

  // Vapi → TeleCMI
  vapiSocket.on('message', (msg) => {
    if (msg instanceof Buffer) {
      if (telecmiSocket?.readyState === WebSocket.OPEN) {
        telecmiSocket.send(msg);
        console.log('📥 Vapi → 📤 TeleCMI (binary)');
      }
    } else {
      try {
        const data = JSON.parse(msg);
        if (data?.type) console.log(`📩 Vapi Event: ${data.type}`);
      } catch {
        console.log('📩 Non-binary Vapi message');
      }
    }
  });

  // TeleCMI → Vapi
  ws.on('message', (msg) => {
    if (vapiSocket?.readyState === WebSocket.OPEN) {
      vapiSocket.send(msg);
      console.log('📤 TeleCMI → Vapi');
    }
  });

  ws.on('close', () => {
    console.log('🔌 TeleCMI disconnected');
    if (vapiSocket?.readyState === WebSocket.OPEN) vapiSocket.close();
  });

  vapiSocket.on('close', () => {
    console.log('🔴 Vapi connection closed');
  });

  vapiSocket.on('error', (err) => {
    console.error('❌ Vapi WebSocket error:', err.message || err);
  });

  ws.on('error', (err) => {
    console.error('❌ TeleCMI WebSocket error:', err.message || err);
  });
});

console.log(`🚀 WebSocket relay listening on ws://0.0.0.0:${SERVER_PORT}`);
console.log('🔗 Bridging TeleCMI ↔ Vapi');
console.log('⏳ Waiting for connection...');
