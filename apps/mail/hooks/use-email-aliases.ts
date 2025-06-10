import { useQuery } from '@tanstack/react-query';
import { useWebSocketMail } from './use-websocket-mail';

export function useEmailAliases() {
  const { sendMessage } = useWebSocketMail();
  const emailAliasesQuery = useQuery({
    queryKey: ['email-aliases'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_email_aliases',
      });
    },
    initialData: [] as { email: string; name: string; primary?: boolean }[],
    staleTime: 1000 * 60 * 60,
  });
  return emailAliasesQuery;
}
