import { addOptimisticActionAtom, removeOptimisticActionAtom } from '@/store/optimistic-updates';
import { optimisticActionsManager, type PendingAction } from '@/lib/optimistic-actions-manager';
import { useQueryClient } from '@tanstack/react-query';
import { focusedIndexAtom } from '@/hooks/use-mail-navigation';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import type { ThreadDestination } from '@/lib/thread-actions';
import { useMail } from '@/components/mail/use-mail';
import { useCallback, useRef } from 'react';
import { useTranslations } from 'use-intl';
import { useQueryState } from 'nuqs';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import { useWebSocketMail } from './use-websocket-mail';

export function useOptimisticActions() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const [, addOptimisticAction] = useAtom(addOptimisticActionAtom);
  const [, removeOptimisticAction] = useAtom(removeOptimisticActionAtom);
  const [threadId, setThreadId] = useQueryState('threadId');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setFocusedIndex] = useAtom(focusedIndexAtom);
  const [mail, setMail] = useMail();
  const { sendAction } = useWebSocketMail();

  const generatePendingActionId = () =>
    `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const refreshData = useCallback(
    async (threadIds: string[], folders?: string[]) => {
      return await Promise.all([
        queryClient.refetchQueries({ queryKey: ['mail-count'] }),
        ...(folders?.map((folder) =>
          queryClient.refetchQueries({
            queryKey: ['threads', folder],
          }),
        ) ?? []),
        ...threadIds.map((id) =>
          queryClient.refetchQueries({
            queryKey: ['thread', id],
          }),
        ),
      ]);
    },
    [queryClient],
  );

  function createPendingAction({
    type,
    threadIds,
    params,
    optimisticId,
    execute,
    undo,
    toastMessage,
    folders,
  }: {
    type: 'MOVE' | 'STAR' | 'READ' | 'LABEL' | 'IMPORTANT';
    threadIds: string[];
    params: any;
    optimisticId: string;
    execute: () => Promise<void>;
    undo: () => void;
    toastMessage: string;
    folders?: string[];
  }) {
    const pendingActionId = generatePendingActionId();
    optimisticActionsManager.lastActionId = pendingActionId;
    console.log('here Generated pending action ID:', pendingActionId);

    if (!optimisticActionsManager.pendingActionsByType.has(type)) {
      console.log('here Creating new Set for action type:', type);
      optimisticActionsManager.pendingActionsByType.set(type, new Set());
    }
    optimisticActionsManager.pendingActionsByType.get(type)?.add(pendingActionId);
    console.log(
      'here',
      'Added pending action to type:',
      type,
      'Current size:',
      optimisticActionsManager.pendingActionsByType.get(type)?.size,
    );

    const pendingAction: PendingAction = {
      id: pendingActionId,
      type,
      threadIds,
      params,
      optimisticId,
      execute,
      undo,
    };

    optimisticActionsManager.pendingActions.set(pendingActionId, pendingAction);

    const itemCount = threadIds.length;
    const bulkActionMessage = itemCount > 1 ? `${toastMessage} (${itemCount} items)` : toastMessage;

    async function doAction() {
      try {
        await execute();
        const typeActions = optimisticActionsManager.pendingActionsByType.get(type);
        console.log('here', {
          pendingActionsByTypeRef: optimisticActionsManager.pendingActionsByType.get(type)?.size,
          pendingActionsRef: optimisticActionsManager.pendingActions.size,
          typeActions: typeActions?.size,
        });
        optimisticActionsManager.pendingActions.delete(pendingActionId);
        optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
        if (typeActions?.size === 1) {
          await refreshData(threadIds, folders);
          removeOptimisticAction(optimisticId);
        }
      } catch (error) {
        console.error('Action failed:', error);
        removeOptimisticAction(optimisticId);
        optimisticActionsManager.pendingActions.delete(pendingActionId);
        optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
        showToast.error('Action failed');
      }
    }

    const showToast = toast;

    if (toastMessage.trim().length) {
      toast(bulkActionMessage, {
        onAutoClose: () => {
          doAction();
        },
        onDismiss: () => {
          doAction();
        },
        action: {
          label: 'Undo',
          onClick: () => {
            undo();
            optimisticActionsManager.pendingActions.delete(pendingActionId);
            optimisticActionsManager.pendingActionsByType.get(type)?.delete(pendingActionId);
          },
        },
        duration: 5000,
      });
    } else {
      doAction();
    }

    return pendingActionId;
  }

  function optimisticMarkAsRead(threadIds: string[], silent = false) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'READ',
      threadIds,
      read: true,
    });

    sendAction({
      type: 'zero_mail_mark_read',
      threadIds,
      optimisticId,
    });

    createPendingAction({
      type: 'READ',
      threadIds,
      params: { read: true },
      optimisticId,
      execute: async () => {
        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: silent ? '' : 'Marked as read',
    });
  }

  function optimisticMarkAsUnread(threadIds: string[]) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'READ',
      threadIds,
      read: false,
    });

    sendAction({
      type: 'zero_mail_mark_unread',
      threadIds,
      optimisticId,
    });

    createPendingAction({
      type: 'READ',
      threadIds,
      params: { read: false },
      optimisticId,
      execute: async () => {
        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: 'Marked as unread',
    });
  }

  function optimisticToggleStar(threadIds: string[], starred: boolean) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'STAR',
      threadIds,
      starred,
    });

    sendAction({
      type: 'zero_mail_toggle_star',
      threadIds,
      starred,
      optimisticId,
    });

    createPendingAction({
      type: 'STAR',
      threadIds,
      params: { starred },
      optimisticId,
      execute: async () => {
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: starred
        ? t('common.actions.addedToFavorites')
        : t('common.actions.removedFromFavorites'),
    });
  }

  function optimisticMoveThreadsTo(
    threadIds: string[],
    currentFolder: string,
    destination: ThreadDestination,
  ) {
    if (!threadIds.length || !destination) return;

    const optimisticId = addOptimisticAction({
      type: 'MOVE',
      threadIds,
      destination,
    });

    threadIds.forEach((id) => {
      setBackgroundQueue({ type: 'add', threadId: `thread:${id}` });
    });

    if (threadId && threadIds.includes(threadId)) {
      setThreadId(null);
      setActiveReplyId(null);
    }
    const successMessage =
      destination === 'inbox'
        ? t('common.actions.movedToInbox')
        : destination === 'spam'
          ? t('common.actions.movedToSpam')
          : destination === 'bin'
            ? t('common.actions.movedToBin')
            : t('common.actions.archived');

    sendAction({
      type: 'zero_mail_bulk_archive',
      threadIds,
      currentFolder,
      optimisticId,
    });

    createPendingAction({
      type: 'MOVE',
      threadIds,
      params: { currentFolder, destination },
      optimisticId,
      execute: async () => {
        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      toastMessage: successMessage,
      folders: [currentFolder, destination],
    });
  }

  function optimisticDeleteThreads(threadIds: string[], currentFolder: string) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'MOVE',
      threadIds,
      destination: 'bin',
    });

    threadIds.forEach((id) => {
      setBackgroundQueue({ type: 'add', threadId: `thread:${id}` });
    });

    if (threadId && threadIds.includes(threadId)) {
      setThreadId(null);
      setActiveReplyId(null);
    }

    sendAction({
      type: 'zero_mail_bulk_delete',
      threadIds,
      optimisticId,
    });

    createPendingAction({
      type: 'MOVE',
      threadIds,
      params: { currentFolder, destination: 'bin' },
      optimisticId,
      execute: async () => {
        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      undo: () => {
        removeOptimisticAction(optimisticId);

        threadIds.forEach((id) => {
          setBackgroundQueue({ type: 'delete', threadId: `thread:${id}` });
        });
      },
      toastMessage: t('common.actions.movedToBin'),
    });
  }

  function optimisticToggleImportant(threadIds: string[], isImportant: boolean) {
    if (!threadIds.length) return;

    const optimisticId = addOptimisticAction({
      type: 'IMPORTANT',
      threadIds,
      important: isImportant,
    });

    sendAction({
      type: 'zero_mail_modify_labels',
      threadIds,
      addLabelIds: isImportant ? ['IMPORTANT'] : [],
      removeLabelIds: isImportant ? [] : ['IMPORTANT'],
      optimisticId,
    });

    createPendingAction({
      type: 'IMPORTANT',
      threadIds,
      params: { important: isImportant },
      optimisticId,
      execute: async () => {
        if (mail.bulkSelected.length > 0) {
          setMail({ ...mail, bulkSelected: [] });
        }
      },
      undo: () => {
        removeOptimisticAction(optimisticId);
      },
      toastMessage: isImportant ? 'Marked as important' : 'Unmarked as important',
    });
  }

  function undoLastAction() {
    if (!optimisticActionsManager.lastActionId) return;

    const lastAction = optimisticActionsManager.pendingActions.get(
      optimisticActionsManager.lastActionId,
    );
    if (!lastAction) return;

    lastAction.undo();

    optimisticActionsManager.pendingActions.delete(optimisticActionsManager.lastActionId);
    optimisticActionsManager.pendingActionsByType
      .get(lastAction.type)
      ?.delete(optimisticActionsManager.lastActionId);

    if (lastAction.toastId) {
      toast.dismiss(lastAction.toastId);
    }

    optimisticActionsManager.lastActionId = null;
  }

  return {
    optimisticMarkAsRead,
    optimisticMarkAsUnread,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
    optimisticToggleImportant,
    undoLastAction,
  };
}
