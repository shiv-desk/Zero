import {
  createDataStreamResponse,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
} from 'ai';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { systemPrompt } from './system-prompt';
import { addHours, isAfter } from 'date-fns';
import { openai } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';

export class ZeroCallAgent extends AIChatAgent<
  Env,
  {
    name: string;
    lastActivity: Date;
  }
> {
  public expiresAt: Date = addHours(new Date(), 1);
  private authenticated: boolean = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void this.initializeAgent();
  }

  private async initializeAgent() {
    await this.refreshTTL();
  }

  private async authenticate() {
    const db = createDb(env.HYPERDRIVE.connectionString);
    const activeConnection = await db.query.connection.findFirst({
      where: (connection, { eq }) => eq(connection.id, connectionId),
    });

    if (!activeConnection) {
      return c.text('Unauthorized', 401);
    }
  }

  public async onChatMessage(onFinish: StreamTextOnFinishCallback<ToolSet>) {
    await this.refreshTTL();

    return createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          const stream = streamText({
            model: openai('gpt-4o'),
            system: systemPrompt,
            messages: this.messages,
            maxSteps: 10,
            onFinish: (result) => {
              this.updateActivityState();
              if (onFinish) {
                onFinish(result);
              }
            },
          });

          stream.mergeIntoDataStream(dataStream);
        } catch (error) {
          console.error(`Error in onChatMessage: ${error}`);
        }
      },
    });
  }

  public async nonStreamingCall(message: string) {
    try {
      await this.refreshTTL();

      if (!message.trim()) {
        return {
          success: false,
          error: 'Message cannot be empty',
        };
      }

      this.saveMessages([
        ...this.messages,
        {
          id: nanoid(),
          role: 'user',
          content: message,
        },
      ]);
    } catch (error) {
      console.error(`Error in handleNonStreamingMessage: ${error}`);

      return {
        success: false,
        error: `An error occurred while processing your message: ${error}`,
      };
    }
  }

  private async updateActivityState() {
    this.setState({
      ...this.state,
      lastActivity: new Date(),
    });
  }

  private async refreshTTL() {
    this.expiresAt = addHours(new Date(), 1);

    // Set alarm for expiry
    await this.ctx.storage.setAlarm(this.expiresAt);
  }

  alarm = async () => {
    const shouldExpire = isAfter(new Date(), this.expiresAt);

    if (shouldExpire) {
      // Clear all data including messages and state
      this.messages = [];
      await this.ctx.storage.deleteAll();
      console.log(`Expired chat agent: ${this.name}`);
    }
  };
}
