import useBackgroundQueue from '@/hooks/ui/use-background-queue';
import { useMail } from '@/components/mail/use-mail';
import { useWebSocketMail } from '../use-websocket-mail';
import { useThreads } from '@/hooks/use-threads';
import { useStats } from '@/hooks/use-stats';
import { useTranslations } from 'use-intl';
import { useState } from 'react';
import { toast } from 'sonner';

const useDelete = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mail, setMail] = useMail();
  const [{ refetch: refetchThreads }] = useThreads();
  const { refetch: refetchStats } = useStats();
  const t = useTranslations();
  const { addToQueue, deleteFromQueue } = useBackgroundQueue();
  const { sendAction } = useWebSocketMail();

  return {
    mutate: (id: string, type: 'thread' | 'email' = 'thread') => {
      setIsLoading(true);
      addToQueue(id);
      return toast.promise(
        Promise.resolve(sendAction({
          type: 'zero_mail_bulk_delete',
          threadIds: [id],
        })),
        {
          loading: t('common.actions.deletingMail'),
          success: t('common.actions.deletedMail'),
          error: (error) => {
            console.error(`Error deleting ${type}:`, error);

            return t('common.actions.failedToDeleteMail');
          },
          finally: async () => {
            setMail({
              ...mail,
              bulkSelected: [],
            });
            setIsLoading(false);
            await Promise.all([refetchThreads(), refetchStats()]);
          },
        },
      );
    },
    isLoading,
  };
};

export default useDelete;
