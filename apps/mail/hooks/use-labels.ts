import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '@/lib/auth-client';

export function useLabels() {
  const { data: session } = useSession();
  const { sendMessage } = useWebSocketMail();
  
  const labelQuery = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_labels',
      });
    },
    enabled: !!session?.user.id,
    staleTime: 1000 * 60 * 60,
  });
  
  return labelQuery;
}

export function useThreadLabels(ids: string[]) {
  const { data: labels = [] } = useLabels();

  const threadLabels = useMemo(() => {
    if (!labels) return [];
    return labels.filter((label) => (label.id ? ids.includes(label.id) : false));
  }, [labels, ids]);

  return { labels: threadLabels };
}
