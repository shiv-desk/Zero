import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

export const useDraft = (id: string | null) => {
  const { data: session } = useSession();
  const { sendMessage } = useWebSocketMail();
  
  const draftQuery = useQuery({
    queryKey: ['thread', id],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_thread',
        id: id!,
      });
    },
    enabled: !!session?.user.id && !!id,
    staleTime: 1000 * 60 * 60,
  });
  
  return draftQuery;
};
