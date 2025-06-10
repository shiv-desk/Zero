import { useActiveConnection } from '@/hooks/use-connections';
import { useQueryClient } from '@tanstack/react-query';

import { usePartySocket } from 'partysocket/react';
import { useThreads } from '@/hooks/use-threads';
import { useLabels } from '@/hooks/use-labels';
import { useSession } from '@/lib/auth-client';
import { funnel } from 'remeda';

const DEBOUNCE_DELAY = 10_000; // 10 seconds is appropriate for real-time notifications

export const NotificationProvider = ({ headers }: { headers: Record<string, string> }) => {
  const queryClient = useQueryClient();
  const { data: activeConnection } = useActiveConnection();

  const labelsDebouncer = funnel(
    () => queryClient.invalidateQueries({ queryKey: ['labels'] }),
    { minQuietPeriodMs: DEBOUNCE_DELAY },
  );

  usePartySocket({
    party: 'zero-agent',
    room: activeConnection?.id ? `${activeConnection.id}` : 'general',
    prefix: 'agents',
    maxRetries: 1,
    query: {
      token: headers['cookie'],
    },
    host: import.meta.env.VITE_PUBLIC_BACKEND_URL!,
    onMessage: async (message: MessageEvent<string>) => {
      try {
        console.warn('party message', message);
        const data = JSON.parse(message.data);
        
        switch (data.type) {
          case 'zero_mail_list_threads':
            queryClient.setQueryData(['threads', data.folder || 'inbox'], (oldData: any) => {
              if (!oldData) return { pages: [data.result], pageParams: [''] };
              return {
                ...oldData,
                pages: [data.result, ...oldData.pages.slice(1)]
              };
            });
            break;
            
          case 'zero_mail_get_thread':
            if (data.messageId) {
              queryClient.setQueryData(['thread', data.result.id], data.result);
            }
            break;
            
          case 'zero_mail_action_complete':
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            queryClient.invalidateQueries({ queryKey: ['thread'] });
            break;
            
          case 'zero_mail_action_error':
            console.error('Mail action failed:', data.error);
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            break;
            
          case 'zero_mail_count':
            if (data.messageId) {
              queryClient.setQueryData(['mail-count'], data.result);
            }
            break;
            
          case 'zero_mail_get_labels':
            if (data.messageId) {
              queryClient.setQueryData(['labels'], data.result);
            }
            break;
            
          case 'zero_mail_get_email_aliases':
            if (data.messageId) {
              queryClient.setQueryData(['email-aliases'], data.result);
            }
            break;
            
          case 'refresh':
            labelsDebouncer.call();
            if (data.threadIds) {
              await Promise.all(
                data.threadIds.map(async (threadId: string) => {
                  await queryClient.invalidateQueries({
                    queryKey: ['thread', threadId],
                  });
                }),
              );
            }
            console.warn('refetched labels & threads', data.threadIds);
            break;
            
          case 'list':
            labelsDebouncer.call();
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            if (data.threadIds) {
              await Promise.all(
                data.threadIds.map(async (threadId: string) => {
                  await queryClient.invalidateQueries({
                    queryKey: ['thread', threadId],
                  });
                }),
              );
            }
            console.warn('refetched threads, added', data.threadIds);
            break;
        }
      } catch (error) {
        console.error('error parsing party message', error);
      }
    },
  });

  return <></>;
};
