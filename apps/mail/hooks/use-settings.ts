import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

export function useSettings() {
  const { data: session } = useSession();
  const { sendMessage } = useWebSocketMail();

  const settingsQuery = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_settings',
      });
    },
    enabled: !!session?.user.id,
    staleTime: Infinity,
  });

  return settingsQuery;
}
