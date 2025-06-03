import {
  twilioSocketMessageSchema,
  type TwilioSocketMessage,
} from './twilio-socket-message-schema';
import { elevenLabsIncomingSocketMessageSchema } from './eleven-labs-incoming-message-schema';
import type { ElevenLabsOutgoingSocketMessage } from './eleven-labs-outgoing-message-schema';
import { ElevenLabsClient } from 'elevenlabs';
import { env } from 'cloudflare:workers';
import { Twilio } from 'twilio';
import { ZodError } from 'zod';

export class CallService {
  private callSid: string | null = null;
  private streamSid: string | null = null;
  private elevenLabsWebSocket: WebSocket | null = null;
  private callWebSocket: WebSocket | null = null;
  private twilio: Twilio;

  constructor() {
    this.twilio = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  public async startCall(callWebSocket: WebSocket, callSid: string) {
    this.callSid = callSid;
    this.callWebSocket = callWebSocket;

    this.attachCallWebSocketEventListeners(callWebSocket);
    await this.connectToElevenLabs();
    console.log(`[Twilio] WebSocket connected for call ${this.callSid}`);
  }

  public async stopCall() {
    this.elevenLabsWebSocket?.close();
    await this.endTwilioCall();
  }

  private async endTwilioCall() {
    if (!this.callSid) {
      throw new Error('[Twilio] Call SID not set');
    }

    await this.twilio.calls(this.callSid).update({
      status: 'completed',
    });
    this.callWebSocket?.close();
  }

  private attachCallWebSocketEventListeners(callWebSocket: WebSocket) {
    callWebSocket.addEventListener('message', async (event) => {
      try {
        await this.handleTwilioMessage(event.data.toString());
      } catch (error) {
        console.error(`[Twilio] Error processing Twilio message for call ${this.callSid}:`, error);
      }
    });

    callWebSocket.addEventListener('close', (event) => {
      console.log(`[Twilio] WebSocket closed for call ${this.callSid}, code: ${event.code}`);
      this.elevenLabsWebSocket?.close();
    });

    callWebSocket.addEventListener('error', (event) => {
      console.error(`[Twilio] WebSocket error for call ${this.callSid}:`, event);
      this.elevenLabsWebSocket?.close();
    });
  }

  private async handleTwilioMessage(message: string) {
    try {
      const data = twilioSocketMessageSchema.parse(JSON.parse(message));

      switch (data.event) {
        case 'connected':
          console.log('[DEBUG] handling twilio connected message', data);
          console.log(`[Twilio] Connected for call ${this.callSid}`);
          break;
        case 'start':
          console.log('[DEBUG] handling twilio start message', data);
          console.log(`[Twilio] Media stream started for call ${this.callSid}`);
          this.streamSid = data.streamSid;
          break;
        case 'media':
          // (Twilio -> ElevenLabs)
          this.sendToElevenLabs({
            user_audio_chunk: data.media.payload,
          });
          break;
        case 'stop':
          console.log(`[Twilio] Media stream stopped for call ${this.callSid}`);
          this.elevenLabsWebSocket?.close();
          await this.endTwilioCall();
          break;
        default:
          console.warn(`[Twilio] Unhandled event: ${data.event}`);
          break;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(
          `[Twilio] [Zod] Error processing Twilio message for call ${this.callSid}:`,
          JSON.stringify(error.errors),
        );
        console.log(`[Twilio] Errored Message: ${message}`);
      } else {
        console.error(`[Twilio] Error processing Twilio message for call ${this.callSid}:`, error);
        console.log(`[Twilio] Errored Message: ${message}`);
      }
    }
  }

  private async connectToElevenLabs() {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const elevenLabs = new ElevenLabsClient({
          apiKey: env.ELEVENLABS_API_KEY,
        });

        const signedUrlResponse = await elevenLabs.conversationalAi.getSignedUrl({
          agent_id: env.ELEVENLABS_AGENT_ID,
        });

        this.elevenLabsWebSocket = new WebSocket(signedUrlResponse.signed_url);
        this.elevenLabsWebSocket.addEventListener('open', () => {
          console.log(`[ElevenLabs] WebSocket connected`);

          this.sendToElevenLabs({
            type: 'conversation_initiation_client_data',
          });

          resolve();
        });
        this.elevenLabsWebSocket.addEventListener('message', async (event) => {
          console.log(`[ElevenLabs] WebSocket message received`);

          await this.handleElevenLabsMessage(event.data.toString());
        });
        this.elevenLabsWebSocket.addEventListener('error', async (event) => {
          console.error(`[ElevenLabs] WebSocket error:`, event);
          await this.endTwilioCall();
        });
        this.elevenLabsWebSocket.addEventListener('close', async (event) => {
          console.log(`[ElevenLabs] WebSocket closed:`, event);
          await this.endTwilioCall();
        });
      } catch (error) {
        console.error(`[ElevenLabs] Error connecting to ElevenLabs:`, error);
        reject(error);
      }
    });
  }

  private sendToElevenLabs(message: ElevenLabsOutgoingSocketMessage) {
    if (!this.elevenLabsWebSocket || this.elevenLabsWebSocket.readyState !== WebSocket.OPEN) {
      console.warn('[ElevenLabs] WebSocket not connected or not open, skipping message');

      return;
    }

    this.elevenLabsWebSocket.send(JSON.stringify(message));
  }

  private async handleElevenLabsMessage(message: string) {
    console.log('[ElevenLabs] Message received');
    const data = await elevenLabsIncomingSocketMessageSchema.parseAsync(JSON.parse(message));

    switch (data.type) {
      case 'conversation_initiation_metadata':
        console.log(
          '[ElevenLabs] Conversation initiation metadata received',
          data.conversation_initiation_metadata_event,
        );
        break;
      case 'contextual_update':
        console.log(`[ElevenLabs] Contextual update received`);
        break;
      case 'vad_score':
        console.log(`[ElevenLabs] VAD score received`);
        break;
      case 'internal_tentative_agent_response':
        console.log(`[ElevenLabs] Internal tentative agent response received`);
        break;
      case 'agent_response':
        console.log(
          '[ElevenLabs] Agent response received:',
          `"${data.agent_response_event?.agent_response}"`,
        );
        break;
      case 'ping':
        console.log(`[ElevenLabs] Ping received`);
        this.sendToElevenLabs({
          type: 'pong',
          event_id: data.ping_event?.event_id ?? 0,
        });
        break;
      case 'audio':
        // (ElevenLabs -> Twilio)
        this.debugAudio(data.audio_event?.audio_base_64 ?? '');

        console.log(`[ElevenLabs] Audio received`);
        if (data.audio_event?.audio_base_64) {
          console.log(`[ElevenLabs] Sending audio to Twilio`);
          await this.sendAudioToTwilio(data.audio_event.audio_base_64);
        }
        break;
      case 'client_tool_call':
        console.log(`[ElevenLabs] Client tool call received`);
        break;
      case 'agent_response_correction':
        console.log(`[ElevenLabs] Agent response correction received`);
        break;
      case 'interruption':
        console.log(`[ElevenLabs] Interruption received`);
        break;
      case 'user_transcript':
        console.log(
          `[ElevenLabs] User transcript received:`,
          `"${data.user_transcription_event?.user_transcript}"`,
        );
        break;
    }
  }

  private debugAudio(base64: string) {
    if (base64.length === 0) {
      console.log(`[ElevenLabs] Empty audio received`);
      return;
    }

    const buf = Buffer.from(base64, 'base64');
    console.log('[DEBUG] received audio bytes:', buf.length);

    if (Uint8Array.prototype.slice.call(buf, 0, 4).toString() === 'RIFF') {
      console.log('[DEBUG] audio is RIFF');
    } else {
      console.log('[DEBUG] audio is not RIFF');
    }
  }

  private async sendAudioToTwilio(audio: string) {
    console.log('[DEBUG] sending audio to twilio ~~~~~~~~~~~~');

    if (
      !this.callWebSocket ||
      this.callWebSocket.readyState !== WebSocket.OPEN ||
      !this.streamSid
    ) {
      console.error('[Twilio] WebSocket sendAudioToTwilio error');

      throw new Error('[Twilio] WebSocket not connected or not open');
    }

    console.log('[DEBUG] checking audio from 11labs');
    this.debugAudio(audio);

    this.sendToTwilio({
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: audio,
      },
    });
  }

  private sendToTwilio(message: TwilioSocketMessage) {
    console.log('[DEBUG] sending message to twilio');

    if (!this.callWebSocket || this.callWebSocket.readyState !== WebSocket.OPEN) {
      throw new Error('[Twilio] WebSocket not connected or not open');
    }

    this.callWebSocket.send(JSON.stringify(message));
    console.log('[DEBUG] sent message to twilio');
  }
}

// const generateAIResponse = async ({
//   transcript,
//   conversationHistory,
// }: {
//   transcript: string;
//   conversationHistory: readonly {
//     role: 'user' | 'assistant';
//     content: string;
//   }[];
// }) => {
//   try {
//     const { text } = await generateText({
//       model: openai('gpt-4o-mini'),
//       messages: [
//         {
//           role: 'system',
//           content: systemPrompt,
//         },
//         ...conversationHistory,
//         {
//           role: 'user',
//           content: transcript,
//         },
//       ],
//       maxTokens: 100_000,
//     });

//     return text;
//   } catch (error) {
//     console.error('AI processing error', error);

//     return "I'm sorry, I had trouble processing your request. Please try again.";
//   }
// };
