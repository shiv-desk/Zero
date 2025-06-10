import { useActiveConnection } from './use-connections';
import { useWebSocketMail } from './use-websocket-mail';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { useTranslations } from 'use-intl';
import type { Note } from '@/types';

export const useThreadNotes = (threadId: string) => {
  const t = useTranslations();
  const { data: session } = useSession();
  const { sendMessage } = useWebSocketMail();
  const { data: activeConnection } = useActiveConnection();

  const noteQuery = useQuery({
    queryKey: ['notes', threadId],
    queryFn: async () => {
      return await sendMessage({
        type: 'zero_mail_get_notes',
        threadId,
      });
    },
    enabled: !!activeConnection?.id && !!threadId,
    staleTime: 1000 * 60 * 5,
    initialData: { notes: [] as Note[] },
    meta: {
      customError: t('common.notes.errors.failedToLoadNotes'),
    },
  });

  return noteQuery;
};
