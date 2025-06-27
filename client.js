const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'wss://hdyudgdfhej-10.onrender.com'; // Replace with your actual relay WebSocket URL

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket relay');

  // Simulate sending PCM audio to relay (which forwards to Vapi)
  const dummyAudioPath = path.resolve('./sample.pcm'); // Should be 16-bit, mono, 8kHz raw PCM

  if (!fs.existsSync(dummyAudioPath)) {
    console.error('❌ sample.pcm file not found at', dummyAudioPath);
    ws.close();
    return;
  }

  const stream = fs.createReadStream(dummyAudioPath, { highWaterMark: 320 });

  stream.on('data', (chunk) => {
    ws.send(chunk);
    console.log('📤 Sent audio chunk');
  });

  stream.on('end', () => {
    console.log('✅ Audio stream completed');
  });
});

ws.on('message', (data) => {
  if (Buffer.isBuffer(data)) {
    console.log(`📥 Received binary audio from Vapi (${data.length} bytes)`);
    // Optionally, save or process this audio
  } else {
    try {
      const message = JSON.parse(data.toString());
      console.log('📩 JSON Message from server:', message);
    } catch {
      console.log('📄 Text Message:', data.toString());
    }
  }
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Disconnected - Code: ${code}, Reason: ${reason}`);
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});
