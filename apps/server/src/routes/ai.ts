import { env } from 'cloudflare:workers';
import type { ZeroAgent } from '../main';
import { getAgentByName } from 'agents';
import { Hono } from 'hono';

export const aiRouter = new Hono();

aiRouter.get('/', (c) => c.text('Twilio + ElevenLabs + AI Phone System Ready'));

aiRouter.post('/chat/:connectionId', async (c) => {
  const connectionId = c.req.param('connectionId');

  if (!connectionId) {
    return c.text('Missing connectionId', 400);
  }

  const stub = await getAgentByName<Env, ZeroAgent>(env.ZERO_AGENT, connectionId);

  return stub.fetch(c.req.raw);
});
