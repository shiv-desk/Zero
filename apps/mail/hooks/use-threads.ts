import { backgroundQueueAtom, isThreadInBackgroundQueueAtom } from '@/store/backgroundQueue';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchValue } from '@/hooks/use-search-value';
import { useSession } from '@/lib/auth-client';
import { useAtom, useAtomValue } from 'jotai';
import { usePrevious } from './use-previous';
import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQueryState } from 'nuqs';
import { useWebSocketMail } from './use-websocket-mail';

export const useThreads = () => {
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { data: session } = useSession();
  const [backgroundQueue] = useAtom(backgroundQueueAtom);
  const isInQueue = useAtomValue(isThreadInBackgroundQueueAtom);
  const { sendMessage } = useWebSocketMail();

  const threadsQuery = useInfiniteQuery({
    queryKey: ['threads', folder, searchValue.value],
    queryFn: async ({ pageParam = '' }) => {
      return await sendMessage({
        type: 'zero_mail_list_threads',
        folder: folder || 'inbox',
        query: searchValue.value || '',
        maxResults: 50,
        pageToken: pageParam,
      });
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage?.nextPageToken ?? null,
    staleTime: 60 * 1000 * 60,
    enabled: !!session?.user.id,
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

  const loadMore = async () => {
    if (threadsQuery.isLoading || threadsQuery.isFetching) return;
    await threadsQuery.fetchNextPage();
  };

  return [threadsQuery, threads, isReachingEnd, loadMore] as const;
};

export const useThread = (threadId: string | null, historyId?: string | null) => {
  const { data: session } = useSession();
  const [_threadId] = useQueryState('threadId');
  const id = threadId ? threadId : _threadId;
  const { sendMessage } = useWebSocketMail();

  const previousHistoryId = usePrevious(historyId ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!historyId || !previousHistoryId || historyId === previousHistoryId) return;
    queryClient.invalidateQueries({ queryKey: ['thread', id] });
  }, [historyId, previousHistoryId, id]);

  const threadQuery = useQuery({
    queryKey: ['thread', id],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_thread',
        id: id!,
      });
    },
    enabled: !!id && !!session?.user.id,
    staleTime: 1000 * 60 * 60,
  });

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
