import { useActiveConnection } from '@/hooks/use-connections';
import { usePartySocket } from 'partysocket/react';
import { useCallback, useRef } from 'react';

export const useWebSocketMail = () => {
  const { data: activeConnection } = useActiveConnection();
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  
  const socket = usePartySocket({
    party: 'zero-agent',
    room: activeConnection?.id ? `${activeConnection.id}` : 'general',
    prefix: 'agents',
    onMessage: (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        if (data.messageId && messageHandlers.current.has(data.messageId)) {
          const handler = messageHandlers.current.get(data.messageId);
          handler?.(data);
          messageHandlers.current.delete(data.messageId);
        }
      } catch (error) {
        console.error('Error parsing websocket message:', error);
      }
    },
  });

  const sendMessage = useCallback((message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timeout = setTimeout(() => {
        messageHandlers.current.delete(messageId);
        reject(new Error('Request timeout'));
      }, 30000);

      messageHandlers.current.set(messageId, (data) => {
        clearTimeout(timeout);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.result || data);
        }
      });

      socket.send(JSON.stringify({ ...message, messageId }));
    });
  }, [socket]);

  const sendAction = useCallback((message: any) => {
    socket.send(JSON.stringify(message));
  }, [socket]);

  return { sendMessage, sendAction };
};
