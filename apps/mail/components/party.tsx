import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessageAtom, socketAtom } from '@/lib/state/socket';
import { useActiveConnection } from '@/hooks/use-connections';
import { useSearchValue } from '@/hooks/use-search-value';
import { useTRPC } from '@/providers/query-provider';
import { usePartySocket } from 'partysocket/react';
import { useThreads } from '@/hooks/use-threads';
import { useParams } from 'react-router';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { funnel } from 'remeda';

const DEBOUNCE_DELAY = 10_000; // 10 seconds is appropriate for real-time notifications

export const NotificationProvider = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: activeConnection } = useActiveConnection();
  const [searchValue] = useSearchValue();
  const { folder = 'inbox' } = useParams<{ folder: string }>();
  const setSocket = useSetAtom(socketAtom);
  const sendMessage = useSetAtom(sendMessageAtom);
  //   const [, oldData] = useThreads();

  const labelsDebouncer = funnel(
    () => queryClient.invalidateQueries({ queryKey: trpc.labels.list.queryKey() }),
    { minQuietPeriodMs: DEBOUNCE_DELAY },
  );
  const threadsDebouncer = funnel(
    () => queryClient.invalidateQueries({ queryKey: trpc.mail.listThreads.queryKey() }),
    { minQuietPeriodMs: DEBOUNCE_DELAY },
  );

  const socket = usePartySocket({
    party: 'zero-agent',
    room: activeConnection?.id ? `${activeConnection.id}` : 'general',
    prefix: 'agents',
    maxRetries: 1,
    host: import.meta.env.VITE_PUBLIC_BACKEND_URL!,
    onMessage: async (message: MessageEvent<string>) => {
      try {
        const { threadIds, type } = JSON.parse(message.data);
        if (type === 'refresh') {
          labelsDebouncer.call();
          await Promise.all(
            threadIds.map(async (threadId: string) => {
              await queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id: threadId }),
              });
            }),
          );
        } else if (type === 'list') {
          threadsDebouncer.call();
          labelsDebouncer.call();
          await Promise.all(
            threadIds.map(async (threadId: string) => {
              await queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id: threadId }),
              });
            }),
          );
        } else if (type === 'zero_mail_list_threads') {
          console.log('zero_mail_list_threads');

          const data = JSON.parse(message.data) as {
            result: {
              nextPageToken: string;
              threads: { id: string }[];
            };
          };
          queryClient.setQueryData(
            ['listThreads', folder, searchValue.value],
            (oldData: {
              pages: {
                nextPageToken: string;
                threads: { id: string }[];
              }[];
              pageParams: string[];
            }) => {
              return {
                pages: [data.result],
                pageParams: [data.result.nextPageToken],
              };
            },
          );
        }
      } catch (error) {
        console.error('error parsing party message', error);
      }
    },
  });

  useEffect(() => {
    setSocket(socket);
    return () => {
      setSocket(null);
    };
  }, [setSocket, socket]);

  useEffect(() => {
    if (searchValue.value) {
      sendMessage({
        type: 'zero_mail_list_threads',
        folder,
        query: searchValue.value,
        pageToken: '',
      });
    }
  }, [folder, sendMessage, searchValue.value]);

  return <></>;
};
