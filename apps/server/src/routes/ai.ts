import { CallService } from '../services/call-service/call-service';
import { ZeroMCP } from './chat';
import twilio from 'twilio';
import { Hono } from 'hono';

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

aiRouter.get('/mcp', (c) => {
  return ZeroMCP.serve('/mcp', { binding: 'ZERO_MCP' }).fetch(c.req, c.env, ctx);
});

aiRouter.post('/voice', async (c) => {
  const formData = await c.req.formData();
  const callSid = formData.get('CallSid') as string;
  const from = formData.get('From') as string;

  console.log(`Incoming call from ${from} with callSid ${callSid}`);

  const hostHeader = c.req.header('host');
  const voiceResponse = new twilio.twiml.VoiceResponse();
  voiceResponse.connect().stream({
    url: `wss://${hostHeader}/api/ai/call/${callSid}`,
  });

  c.header('Content-Type', 'application/xml');
  return c.body(voiceResponse.toString());
});

aiRouter.get('/call/:callSid', async (c) => {
  console.log('[THE URL]', c.req.url);
  const callSid = c.req.param('callSid');

  console.log(`[Twilio] WebSocket connection requested`);

  // Check for WebSocket upgrade header
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  console.log(`[Twilio] WebSocket connection requested for call ${callSid}`);

  // Create WebSocket pair
  const [client, server] = Object.values(new WebSocketPair());

  // Accept the server WebSocket
  server.accept();

  const callService = new CallService(callSid);
  console.log(`[Twilio] Call service created`);

  c.executionCtx.waitUntil(callService.startCall(server));

  // Handle WebSocket events
  server.addEventListener('open', () => {
    console.log(`[Twilio] WebSocket connection opened`);
  });

  // Return response with status 101 and client WebSocket
  console.log(`[Twilio] Returning response with status 101 and client WebSocket`);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});
