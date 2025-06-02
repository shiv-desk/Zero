import { createCallService } from '../services/call-service';
import { upgradeWebSocket } from 'hono/cloudflare-workers';
import twilio from 'twilio';
import { Hono } from 'hono';

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

aiRouter.post('/voice', async (c) => {
  const hostHeader = c.req.header('host');

  const voiceResponse = new twilio.twiml.VoiceResponse();
  voiceResponse.connect().stream({
    url: `wss://${hostHeader}/api/ai/media-stream`,
  });

  c.header('Content-Type', 'application/xml');
  return c.body(voiceResponse.toString());
});

aiRouter.get(
  '/media-stream',
  upgradeWebSocket(async () => {
    const callService = await createCallService();

    return {
      onMessage: async (event, ws) => {
        console.log('Twilio WebSocket message received', event);

        await callService.handleWebSocketMessage(event.data, (data) => {
          ws.send(data);
        });
      },
      onError: (event) => {
        console.error('WebSocket error', event);
      },
      onClose: (event) => {
        console.log('Twilio WebSocket closed', event);
      },
    };
  }),
);
