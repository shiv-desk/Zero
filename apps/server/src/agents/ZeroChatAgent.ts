import {
  streamText,
  type Message,
  type StreamTextOnFinishCallback,
  tool,
  createDataStreamResponse,
} from 'ai';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { env } from 'cloudflare:workers';
import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * A complete chat-capable Durable Object that relies on the Agents SDK.
 *
 * – Maintains state automatically through AIChatAgent.
 * – Exposes a WebSocket interface handled by the base class.
 * – Provides an HTTP API:
 *   • GET  /history            → full message history as JSON
 *   • POST /chat { message }   → send a user message and stream the assistant reply
 */
export class ZeroChatAgent extends AIChatAgent<typeof env> {
  /**
   * Generate the assistant reply whenever we receive a new user message.
   * The base class already streams data to connected clients; we only need to
   * return a Response to the originator.
   */
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>): Promise<Response> {
    const tools = this.getTools();

    const dataStreamResponse = createDataStreamResponse({
      execute: async (writer) => {
        const result = streamText({
          model: openai('gpt-4o'),
          messages: this.messages,
          onFinish,
          system: 'You are Zero, a helpful AI assistant.',
          tools,
        });
        result.mergeIntoDataStream(writer);
      },
    });

    return dataStreamResponse;
  }

  /* You can add custom tools here */
  private getTools() {
    return {
      getServerTime: tool({
        description: 'Return the current server ISO time-stamp',
        parameters: z.object({}).default({}),
        execute: async () => ({
          content: [
            {
              type: 'text',
              text: new Date().toISOString(),
            },
          ],
        }),
      }),
      // add more tools here as needed
    } as const;
  }

  async prepareTools() {}

  /**
   * HTTP interface: expose history & allow posting a new message without WS.
   */
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. Return the history for any GET request
    if (request.method === 'GET' && url.pathname.endsWith('/history')) {
      return Response.json(this.messages);
    }

    // 2. Accept a user message & trigger the agent
    if (request.method === 'POST' && url.pathname.endsWith('/chat')) {
      const { message } = (await request.json()) as { message: string };
      if (!message) {
        return new Response('Missing "message" in body', { status: 400 });
      }

      const userMsg: Message = {
        id: randomUUID(),
        role: 'user',
        content: message,
      };

      // Persist + generate assistant response (will stream to clients)
      await this.saveMessages([...this.messages, userMsg]);

      // 202 Accepted because the reply is streamed via WS; caller can fetch /history or open WS.
      return new Response(null, { status: 202 });
    }

    // Fallback to the base implementation for other paths (e.g. /get-messages)
    return super.onRequest(request);
  }
}
