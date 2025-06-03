import { getCurrentDateContext, GmailSearchAssistantSystemPrompt } from '../../lib/prompts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createDriver } from '../../lib/driver';
import { FOLDERS } from '../../lib/utils';
import { env } from 'cloudflare:workers';
import { openai } from '@ai-sdk/openai';
import { McpAgent } from 'agents/mcp';
import { createDb } from '../../db';
import { generateText } from 'ai';
import { z } from 'zod';

// TODO: Remove this once we have a proper phone mapping
const mapping: Record<string, { connectionId: string }> = {
  '+18185176315': {
    connectionId: '0f2a3874-8106-441c-86d7-ecad65d063f0',
  },
};

// TODO: remove this too asap
const phoneMapping = async (phoneNumber: string) => {
  console.log('[DEBUG] phoneMapping', phoneNumber);

  const db = createDb(env.HYPERDRIVE.connectionString);

  const obj = mapping[phoneNumber];
  const connection = await db.query.connection.findFirst({
    where: (connection, ops) => {
      return ops.eq(connection.id, obj.connectionId);
    },
  });

  if (!connection) {
    throw new Error('No connection found.');
  }

  if (!connection.accessToken || !connection.refreshToken) {
    throw new Error('Invalid connection');
  }

  const driver = createDriver(connection.providerId, {
    auth: {
      userId: connection.userId,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      email: connection.email,
    },
  });

  return {
    driver,
    connectionId: connection.id,
  };
};

export class ZeroMCP extends McpAgent<typeof env, {}, { phoneNumber: string }> {
  public server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  async init(): Promise<void> {
    const phoneNumber = this.props.phoneNumber;
    const connectionId = mapping[phoneNumber]?.connectionId;
    if (!connectionId) {
      throw new Error('Unauthorized');
    }

    const { driver } = await phoneMapping(phoneNumber);

    this.server.tool(
      'buildGmailSearchQuery',
      {
        query: z.string(),
      },
      async (s) => {
        const result = await generateText({
          model: openai('gpt-4o'),
          system: GmailSearchAssistantSystemPrompt(),
          prompt: s.query,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
        };
      },
    );

    this.server.tool(
      'listThreads',
      {
        folder: z.string().default(FOLDERS.INBOX),
        query: z.string().optional(),
        maxResults: z.number().optional().default(5),
        labelIds: z.array(z.string()).optional(),
        pageToken: z.string().optional(),
      },
      async (s) => {
        const result = await driver.list({
          folder: s.folder,
          query: s.query,
          maxResults: s.maxResults,
          labelIds: s.labelIds,
          pageToken: s.pageToken,
        });
        const content = await Promise.all(
          result.threads.map(async (thread) => {
            const loadedThread = await driver.get(thread.id);
            return [
              {
                type: 'text' as const,
                text: `Subject: ${loadedThread.latest?.subject} | ID: ${thread.id} | Received: ${loadedThread.latest?.receivedOn}`,
              },
            ];
          }),
        );
        return {
          content: content.length
            ? content.flat()
            : [
                {
                  type: 'text' as const,
                  text: 'No threads found',
                },
              ],
        };
      },
    );

    this.server.tool(
      'getThread',
      {
        threadId: z.string(),
      },
      async (s) => {
        const thread = await driver.get(s.threadId);
        const response = await env.VECTORIZE.getByIds([s.threadId]);
        if (response.length && response?.[0]?.metadata?.['content']) {
          const content = response[0].metadata['content'] as string;
          const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: content,
          });
          return {
            content: [
              {
                type: 'text',
                text: shortResponse.summary,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Subject: ${thread.latest?.subject}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'markThreadsRead',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: [],
          removeLabels: ['UNREAD'],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as read',
            },
          ],
        };
      },
    );

    this.server.tool(
      'markThreadsUnread',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: ['UNREAD'],
          removeLabels: [],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as unread',
            },
          ],
        };
      },
    );

    this.server.tool(
      'modifyLabels',
      {
        threadIds: z.array(z.string()),
        addLabelIds: z.array(z.string()),
        removeLabelIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: s.addLabelIds,
          removeLabels: s.removeLabelIds,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Successfully modified ${s.threadIds.length} thread(s)`,
            },
          ],
        };
      },
    );

    this.server.tool('getCurrentDate', async () => {
      return {
        content: [
          {
            type: 'text',
            text: getCurrentDateContext(),
          },
        ],
      };
    });

    this.server.tool('getUserLabels', async () => {
      const labels = await driver.getUserLabels();
      return {
        content: [
          {
            type: 'text',
            text: labels
              .map((label) => `Name: ${label.name} ID: ${label.id} Color: ${label.color}`)
              .join('\n'),
          },
        ],
      };
    });

    this.server.tool(
      'getLabel',
      {
        id: z.string(),
      },
      async (s) => {
        const label = await driver.getLabel(s.id);
        return {
          content: [
            {
              type: 'text',
              text: `Name: ${label.name}`,
            },
            {
              type: 'text',
              text: `ID: ${label.id}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'createLabel',
      {
        name: z.string(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
      },
      async (s) => {
        try {
          await driver.createLabel({
            name: s.name,
            color:
              s.backgroundColor && s.textColor
                ? {
                    backgroundColor: s.backgroundColor,
                    textColor: s.textColor,
                  }
                : undefined,
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Label has been created',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to create label',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkDelete',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: ['TRASH'],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads moved to trash',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to move threads to trash',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkArchive',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: [],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads archived',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to archive threads',
              },
            ],
          };
        }
      },
    );
  }
}
