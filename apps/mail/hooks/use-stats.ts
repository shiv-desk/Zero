import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { useWebSocketMail } from './use-websocket-mail';

export const useStats = () => {
  const { data: session } = useSession();
  const { sendMessage } = useWebSocketMail();

  const statsQuery = useQuery({
    queryKey: ['mail-count'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_count',
      });
    },
    enabled: !!session?.user.id,
    staleTime: 1000 * 60 * 60,
  });

  return statsQuery;
};
