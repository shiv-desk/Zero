import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';

export const useConnections = () => {
  const { sendMessage } = useWebSocketMail();
  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_connections',
      });
    },
    staleTime: 1000 * 60 * 60,
  });
  return connectionsQuery;
};

export const useActiveConnection = () => {
  const { sendMessage } = useWebSocketMail();
  const connectionsQuery = useQuery({
    queryKey: ['active-connection'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_active_connection',
      });
    },
    staleTime: 1000 * 60 * 60,
  });
  return connectionsQuery;
};
