import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';

export const useSummary = (threadId: string | null) => {
  const { sendMessage } = useWebSocketMail();
  const summaryQuery = useQuery({
    queryKey: ['summary', threadId],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_generate_summary',
        threadId: threadId!,
      });
    },
    enabled: !!threadId,
    staleTime: 1000 * 60 * 60,
  });

  return summaryQuery;
};

export const useBrainState = () => {
  const { sendMessage } = useWebSocketMail();
  const brainStateQuery = useQuery({
    queryKey: ['brain-state'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_brain_state',
      });
    },
    staleTime: 1000 * 60 * 60,
  });

  return brainStateQuery;
};
