import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchValue } from '@/hooks/use-search-value';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTRPC } from '@/providers/query-provider';
import { sendMessageAtom, socketAtom } from '@/lib/state/socket';
import { useSession } from '@/lib/auth-client';
import { usePrevious } from './use-previous';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);

  const threadsQuery = useInfiniteQuery<{
    nextPageToken: string;
    threads: {
      id: string;
    }[];
  }>({
    queryKey: ['listThreads', folder, searchValue.value],
    queryFn: async ({ client, queryKey }) => {
      const data = client.getQueryData<{
        pages: {
          nextPageToken: string;
          threads: {
            id: string;
          }[];
        }[];
        pageParams: string[];
      }>(queryKey);

      const threads = data?.pages
        ? data.pages
            .flatMap((e) => e.threads)
            .filter(Boolean)
            .filter((e) => !isInQueue(`thread:${e.id}`))
        : [];

      return {
        nextPageToken: data?.pages[data.pages.length - 1]?.nextPageToken || '',
        threads,
      };
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
  });

  const threads = useMemo(() => {
    return threadsQuery.data
      ? threadsQuery.data.pages
          .flatMap((e) => e.threads)
          .filter(Boolean)
          .filter((e) => !isInQueue(`thread:${e.id}`))
      : [];
  }, [threadsQuery.data, threadsQuery.dataUpdatedAt, isInQueue, backgroundQueue]);

  const isEmpty = useMemo(() => threads.length === 0, [threads]);
  const isReachingEnd =
    isEmpty ||
    (threadsQuery.data &&
      !threadsQuery.data.pages[threadsQuery.data.pages.length - 1]?.nextPageToken);
  const sendMessage = useSetAtom(sendMessageAtom);

  const loadMore = () => {
    if (threadsQuery.isLoading || threadsQuery.isFetching) return;
    if (threadsQuery.hasNextPage && !threadsQuery.isFetchingNextPage) {
      const nextPageToken =
        threadsQuery.data?.pages[threadsQuery.data.pages.length - 1]?.nextPageToken;
      sendMessage({
        type: 'zero_mail_list_threads',
        folder,
        query: searchValue.value,
        pageToken: nextPageToken ?? '',
      });
      threadsQuery.fetchNextPage();
    }
  };

  return [threadsQuery, threads, isReachingEnd, loadMore] as const;
};

export const useThread = (threadId: string | null, historyId?: string | null) => {
  const { data: session } = useSession();
  const [_threadId] = useQueryState('threadId');
  const id = threadId ? threadId : _threadId;
  const trpc = useTRPC();
  const socket = useAtomValue(socketAtom);
  const sendMessage = useSetAtom(sendMessageAtom);

  const previousHistoryId = usePrevious(historyId ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!historyId || !previousHistoryId || historyId === previousHistoryId) return;
    queryClient.invalidateQueries({ queryKey: trpc.mail.get.queryKey({ id: id! }) });
  }, [historyId, previousHistoryId, id]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleMessage = async (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'zero_mail_get_thread' && data.threadId === id) {
          queryClient.setQueryData(
            trpc.mail.get.queryKey({ id }),
            data.result
          );
        }
      } catch (error) {
        console.error('Error parsing thread message', error);
      }
    };

    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, id, queryClient, trpc.mail.get]);

  useEffect(() => {
    if (id && session?.user.id) {
      sendMessage({
        type: 'zero_mail_get_thread',
        threadId: id,
      });
    }
  }, [id, sendMessage, session?.user.id]);

  const threadQuery = useQuery(
    trpc.mail.get.queryOptions(
      {
        id: id!,
      },
      {
        enabled: !!id && !!session?.user.id,
        staleTime: 1000 * 60 * 60, // 60 minutes
      },
    ),
  );

  const isGroupThread = useMemo(() => {
    if (!threadQuery.data?.latest?.id) return false;
    const totalRecipients = [
      ...(threadQuery.data.latest.to || []),
      ...(threadQuery.data.latest.cc || []),
      ...(threadQuery.data.latest.bcc || []),
    ].length;
    return totalRecipients > 1;
  }, [threadQuery.data]);

  return { ...threadQuery, isGroupThread };
};
