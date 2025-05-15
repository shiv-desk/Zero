'use client';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useSearchValue } from '@/hooks/use-search-value';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useCallback, useEffect, memo } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { Markdown } from '@react-email/components';
import {
  Archive2,
  CurvedArrow,
  Star2,
  Trash,
  Reply,
  Check,
  GroupPeople,
  Stop,
} from '../icons/icons';
import { useBilling } from '@/hooks/use-billing';
import { TextShimmer } from '../ui/text-shimmer';
import { useThread, useThreads } from '@/hooks/use-threads';
import { useLabels } from '@/hooks/use-labels';
import { cn, getEmailLogo } from '@/lib/utils';
import { useStats } from '@/hooks/use-stats';
import { useParams } from 'next/navigation';
import { CheckCircle2, Minus } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { Button } from '../ui/button';
import { format } from 'date-fns-tz';
import { useQueryState } from 'nuqs';
import { Input } from '../ui/input';
import { useState } from 'react';
import VoiceChat from './voice';
import Image from 'next/image';
import { toast } from 'sonner';
import { MailLabels } from '../mail/mail-list';
import { useMail } from '@/components/mail/use-mail';
import { useKeyState } from '@/hooks/use-hot-key';
import { useTranslations } from 'use-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { moveThreadsTo, type ThreadDestination } from '@/lib/thread-actions';
import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { useAtom } from 'jotai';
import { useMutation } from '@tanstack/react-query';

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: {
    toolName: string;
    result?: {
      threads?: Array<{ id: string; title: string; snippet: string }>;
      [key: string]: any;
    };
  };
}

const ThreadItem = memo(({
  thread,
  onRemove,
}: {
  thread: { id: string; title: string; snippet: string };
  onRemove?: (id: string) => void;
}) => {
  const [threadId, setThreadId] = useQueryState('threadId');
  const [mode, setMode] = useQueryState('mode');
  const [activeReplyId, setActiveReplyId] = useQueryState('activeReplyId');
  const { data: getThread } = useThread(thread.id);
  const isSelected = threadId === thread.id;
  const isGroupThread = getThread?.latest?.to && getThread.latest.to.length > 1;
  const [mail, setMail] = useMail();
  const isKeyPressed = useKeyState();
  const [isStarred, setIsStarred] = useState(false);
  const [, setBackgroundQueue] = useAtom(backgroundQueueAtom);
  const { folder } = useParams<{ folder: string }>();
  const { refetch: refetchThreads } = useThreads();
  const { refetch: refetchStats } = useStats();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations();
  const { mutateAsync: toggleStar } = useMutation(trpc.mail.toggleStar.mutationOptions());
  
  const { getSelectMode, handleSelectMail } = useSelection(useKeyState(), mail, setMail);

  const isMailBulkSelected = mail.bulkSelected.includes(thread.id);
  const isSelectionMode = mail.bulkSelected.length > 0;

  const handleClick = useCallback((e: React.MouseEvent) => {
    const selectMode = getSelectMode();
    if (selectMode !== 'single') {
      handleSelectMail(thread.id);
    } else {
      setThreadId(thread.id);
    }
  }, [getSelectMode, handleSelectMail, thread.id, setThreadId]);

  // Set initial star state based on email data
  useEffect(() => {
    if (getThread?.latest?.tags) {
      setIsStarred(getThread.latest.tags.some((tag) => tag.name === 'STARRED'));
    }
  }, [getThread?.latest?.tags]);

  const handleToggleStar = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!getThread || !thread.id) return;

      const newStarredState = !isStarred;
      setIsStarred(newStarredState);
      if (newStarredState) {
        toast.success(t('common.actions.addedToFavorites'));
      } else {
        toast.success(t('common.actions.removedFromFavorites'));
      }
      setBackgroundQueue({ 
        type: 'add',
        threadId: `thread:${thread.id}`
      });
      await toggleStar({ ids: [thread.id] });
    },
    [getThread, thread.id, isStarred, toggleStar, setBackgroundQueue, t]
  );

  const handleMoveThread = useCallback(
    async (destination: ThreadDestination) => {
      if (!thread.id) return;
      
      // Remove thread from UI immediately
      onRemove?.(thread.id);

      try {
        await moveThreadsTo({
          threadIds: [thread.id],
          destination,
          currentFolder: folder,
        });
        
        toast.success(
          destination === 'inbox'
            ? t('common.actions.movedToInbox')
            : destination === 'spam'
              ? t('common.actions.movedToSpam')
              : destination === 'bin'
                ? t('common.actions.movedToBin')
                : t('common.actions.archived')
        );

        await Promise.all([
          refetchStats(),
          queryClient.invalidateQueries({
            queryKey: trpc.mail.get.queryKey({ id: thread.id }),
          }),
        ]);
      } catch (error: unknown) {
        toast.error(t('common.actions.failedToMove'));
      }
    },
    [thread.id, t, refetchStats, queryClient, trpc.mail.get.queryKey, onRemove, folder]
  );

  const handleReply = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setThreadId(thread.id);
      setMode('reply');
      setActiveReplyId(thread.id);
    },
    [setThreadId, setMode, setActiveReplyId, thread.id]
  );

  return getThread?.latest ? (
    <div
      onClick={handleClick}
      key={thread.id}
      className={cn(
        "hover:bg-offsetLight/30 dark:hover:bg-[#202020] group relative cursor-pointer rounded-lg",
        isMailBulkSelected && "bg-primary/5"
      )}
    >
      <div className="flex cursor-pointer items-center justify-between p-2">
        <div className="flex w-full items-center gap-3">
          <div 
            className="relative"
            onClick={handleSelectMail}
          >
            {isSelectionMode ? (
              <div
                className={cn(
                  'flex h-[18px] w-[18px] items-center justify-center rounded-md border-2 border-[#484848] transition-colors mr-1.5 ml-2',
                  isMailBulkSelected && 'border-none bg-[#3B82F6]'
                )}
              >
                {isMailBulkSelected && (
                  <Check className="h-3 w-3 text-white dark:fill-[#141414]" />
                )}
              </div>
            ) : (
              <Avatar className="h-8 w-8">
                {isGroupThread ? (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FFFFFF] p-2 dark:bg-[#373737]">
                    <GroupPeople className="h-4 w-4" />
                  </div>
                ) : (
                  <>
                    <AvatarImage
                      className="rounded-full bg-[#FFFFFF] dark:bg-[#373737]"
                      src={getEmailLogo(getThread.latest?.sender?.email)}
                    />
                    <AvatarFallback className="rounded-full bg-[#FFFFFF] font-bold text-[#9F9F9F] dark:bg-[#373737]">
                      <span className='relative right-[0.5px] top-[1px]'>{getThread.latest?.sender?.name?.[0]?.toUpperCase()}</span>
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
            )}
            {getThread.latest?.unread && !isSelected && !isSelectionMode ? (
              <span className="absolute z-2 -bottom-[1px] right-0.5 size-2 rounded bg-[#006FFE]" />
            ) : null}
          </div>
          <div className="flex w-full flex-col">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1">
                <p className={cn(
                  "truncate text-sm text-black dark:text-white",
                  getThread.latest?.unread && !isSelected ? "font-bold" : "font-medium"
                )}>
                  {getThread.latest?.sender?.name}
                </p>
              </div>
              <span className="text-nowrap text-xs text-[#8C8C8C] dark:text-[#8C8C8C]">
                {getThread.latest.receivedOn ? format(getThread.latest.receivedOn, 'MMMM do') : ''}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <p className={cn('mt-1 line-clamp-1 w-full text-sm text-[#8C8C8C] min-w-0')}>
                {getThread.latest?.subject}
              </p>
              <MailLabels labels={getThread.latest?.tags || []} />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-2 top-[-2] z-[25] flex -translate-y-1/2 items-center gap-1 rounded-xl border bg-white p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-[#1A1A1A]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 overflow-visible [&_svg]:size-3"
              onClick={handleReply}
            >
              <Reply className="fill-[#6D6D6D] dark:fill-[#9B9B9B] h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
            {t('common.threadDisplay.reply')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 overflow-visible [&_svg]:size-3.5"
              onClick={handleToggleStar}
            >
              <Star2
                className={cn(
                  'h-4 w-4',
                  isStarred
                    ? 'fill-yellow-400 stroke-yellow-400'
                    : 'fill-transparent stroke-[#9D9D9D] dark:stroke-[#9D9D9D]',
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
            {isStarred ? t('common.threadDisplay.unstar') : t('common.threadDisplay.star')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 [&_svg]:size-3.5"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleMoveThread('archive');
              }}
            >
              <Archive2 className="fill-[#9D9D9D]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
            {t('common.threadDisplay.archive')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-[#FDE4E9] dark:hover:bg-[#411D23] [&_svg]:size-3.5"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleMoveThread('bin');
              }}
            >
              <Trash className="fill-[#F43F5E]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="mb-1 bg-white dark:bg-[#1A1A1A]">
            {t('common.actions.Bin')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  ) : null;
}) as React.MemoExoticComponent<React.ComponentType<{
  thread: { id: string; title: string; snippet: string };
  onRemove?: (id: string) => void;
}>>;

ThreadItem.displayName = 'ThreadItem';

const RenderThreads = ({
  threads,
}: {
  threads: { id: string; title: string; snippet: string }[];
}) => {
  return (
    <div className="flex flex-col gap-2">
      {threads.map((thread) => (
        <ThreadItem key={thread.id} thread={thread} />
      ))}
    </div>
  );
};

const ExampleQueries = ({ onQueryClick }: { onQueryClick: (query: string) => void }) => {
  const firstRowQueries = [
    'Find invoice from Stripe',
    'Show unpaid invoices',
    'Show recent work feedback',
  ];

  const secondRowQueries = ['Find all work meetings', 'What projects do i have coming up'];

  return (
    <div className="mt-6 flex w-full flex-col items-center gap-2">
      {/* First row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {firstRowQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]"
            >
              {query}
            </button>
          ))}
        </div>
        {/* Left mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
        {/* Right mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
      </div>

      {/* Second row */}
      <div className="no-scrollbar relative flex w-full justify-center overflow-x-auto">
        <div className="flex gap-4 px-4">
          {secondRowQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => onQueryClick(query)}
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-[#f0f0f0] p-1 px-2 text-sm text-[#555555] dark:bg-[#262626] dark:text-[#929292]"
            >
              {query}
            </button>
          ))}
        </div>
        {/* Left mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 left-0 top-0 w-12 bg-gradient-to-r to-transparent"></div>
        {/* Right mask */}
        <div className="from-panelLight dark:from-panelDark pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l to-transparent"></div>
      </div>
    </div>
  );
};

export function AIChat() {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { refetch, chatMessages } = useBilling();
  const [threadId] = useQueryState('threadId');
  const { refetch: refetchLabels } = useLabels();
  const { refetch: refetchStats } = useStats();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { refetch: refetchThread } = useThread(threadId);
  const { folder } = useParams<{ folder: string }>();
  const [searchValue] = useSearchValue();
  const { attach, track, refetch: refetchBilling } = useBilling();
  const t = useTranslations();
  const [mail] = useMail();
  const [, threads] = useThreads();
  const [displayedThreads, setDisplayedThreads] = useState<Array<{ id: string; title: string; snippet: string }>>([]);

  const { messages, input, setInput, error, handleSubmit, status, stop } = useChat({
    api: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`,
    fetch: (url, options) => fetch(url, { ...options, credentials: 'include' }),
    maxSteps: 5,
    body: {
      threadId: threadId ?? undefined,
      currentFolder: folder ?? undefined,
      currentFilter: searchValue.value ?? undefined,
    },
    onError(error) {
      console.error('Error in useChat', error);
      toast.error('Error, please try again later');
    },
    onResponse: (response) => {
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    },
    onFinish: () => {},
    async onToolCall({ toolCall }) {
      console.warn('toolCall', toolCall);
      switch (toolCall.toolName) {
        case 'createLabel':
          await refetchLabels();
          break;
        case 'sendEmail':
          await queryClient.invalidateQueries({
            queryKey: trpc.mail.listThreads.queryKey({ folder: 'sent' }),
          });
          break;
        case 'markThreadsRead':
        case 'markThreadsUnread':
        case 'modifyLabels':
          console.log('modifyLabels', toolCall.args);
          await refetchLabels();
          await Promise.all(
            (toolCall.args as { threadIds: string[] }).threadIds.map((id) =>
              queryClient.invalidateQueries({
                queryKey: trpc.mail.get.queryKey({ id }),
              }),
            ),
          );
          break;
      }
      await track({ featureId: 'chat-messages', value: 1 });
      await refetchBilling();
    },
  });

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleUpgrade = async () => {
    if (attach) {
      return attach({
        productId: 'pro-example',
        successUrl: `${window.location.origin}/mail/inbox?success=true`,
      })
        .catch((error: Error) => {
          console.error('Failed to upgrade:', error);
        })
        .then(() => {
          console.log('Upgraded successfully');
        });
    }
  };

  const handleRemoveThread = useCallback((threadId: string) => {
    setDisplayedThreads(prev => prev.filter(t => t.id !== threadId));
  }, []);

  // Update displayedThreads when messages change
  useEffect(() => {
    const threads = messages.flatMap(message => 
      message.parts
        .filter(part => {
          if (part.type !== 'tool-invocation') return false;
          const invocation = (part as any).toolInvocation;
          return (
            invocation !== undefined &&
            'result' in invocation &&
            typeof invocation.result === 'object' &&
            invocation.result !== null &&
            'threads' in invocation.result &&
            Array.isArray(invocation.result.threads)
          );
        })
        .flatMap(part => ((part as any).toolInvocation.result as { threads: Array<{ id: string; title: string; snippet: string }> }).threads)
    );
    setDisplayedThreads(threads);
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="min-h-full space-y-4 px-2 py-4">
          {chatMessages && !chatMessages.enabled ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <TextShimmer className="text-center text-xl font-medium">
                Upgrade to Zero Pro for unlimited AI chats
              </TextShimmer>
              <Button onClick={handleUpgrade} className="mt-2 h-8 w-52">
                Upgrade
              </Button>
            </div>
          ) : !messages.length ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative mb-4 h-[44px] w-[44px]">
                <Image src="/black-icon.svg" alt="Zero Logo" fill className="dark:hidden" />
                <Image src="/white-icon.svg" alt="Zero Logo" fill className="hidden dark:block" />
              </div>
              <p className="mb-1 mt-2 hidden text-center text-sm font-medium text-black md:block dark:text-white">
                Ask anything about your emails
              </p>
              <p className="mb-3 text-center text-sm text-[#8C8C8C] dark:text-[#929292]">
                Ask to do or show anything using natural language
              </p>

              {/* Example Thread */}
              <ExampleQueries
                onQueryClick={(query) => {
                  setInput(query);
                  inputRef.current?.focus();
                }}
              />
            </div>
          ) : (
            messages.map((message, index) => {
              const textParts = message.parts.filter((part) => part.type === 'text');
              const toolParts = message.parts.filter((part) => part.type === 'tool-invocation');
              
              return (
                <div key={`${message.id}-${index}`} className="flex flex-col gap-2">
                  {toolParts.map((part, idx) => {
                    if (part.type !== 'tool-invocation') return null;
                    
                    const invocation = (part as any).toolInvocation;
                    if (
                      invocation &&
                      'result' in invocation &&
                      typeof invocation.result === 'object' &&
                      invocation.result !== null &&
                      'threads' in invocation.result &&
                      Array.isArray(invocation.result.threads)
                    ) {
                      return (
                        <div key={idx}>
                          {(invocation.result.threads as Array<{ id: string; title: string; snippet: string }>)
                            .filter(thread => displayedThreads.some(t => t.id === thread.id))
                            .map(thread => (
                              <ThreadItem 
                                key={thread.id} 
                                thread={thread} 
                                onRemove={handleRemoveThread}
                              />
                            ))
                          }
                        </div>
                      );
                    }
                    
                    // return (
                    //   <span key={idx} className="text-muted-foreground flex gap-1 text-xs">
                    //     <CheckCircle2 className="h-4 w-4" />
                    //     Used tool: {invocation.toolName}
                    //   </span>
                    // );
                  })}
                  {textParts.length > 0 && (
                    <div className={cn(
                      'flex w-fit flex-col gap-2 rounded-xl text-sm shadow',
                      message.role === 'user'
                        ? 'overflow-wrap-anywhere text-subtleWhite dark:text-offsetDark ml-auto break-words bg-[#252525] p-2 dark:bg-[#f0f0f0]'
                        : 'overflow-wrap-anywhere mr-auto break-words bg-[#f0f0f0] px-2 py-2.5 dark:bg-[#252525]',
                    )}>
                      {textParts.map((part) => (
                        <Markdown key={part.text}>{part.text}</Markdown>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />

          {status === 'submitted' && (
            <div className="flex flex-col gap-2 rounded-lg">
              <div className="flex items-center gap-2">
                <TextShimmer className="text-muted-foreground text-sm">
                  zero is thinking...
                </TextShimmer>
              </div>
            </div>
          )}
          {(status === 'error' || !!error) && (
            <div className="text-sm text-red-500">Error, please try again later</div>
          )}
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="mb-4 flex-shrink-0 px-4">
        <div className="bg-offsetLight border-border/50 relative rounded-lg dark:bg-[#141414]">
          {showVoiceChat ? (
            <VoiceChat onClose={() => setShowVoiceChat(false)} />
          ) : (
            <div className="flex flex-col">
              {mail?.bulkSelected?.length > 0 && (
                <div className="mb-2 flex items-center bg-[#141414] rounded-xl">
                  <div className="flex items-center gap-1.5 rounded-md px-2 pt-2 text-xs text-white font-medium">
                    <div className="flex h-4 w-4 items-center justify-center">
                      {mail?.bulkSelected?.length === threads?.length ? (
                        <div className="flex h-4 w-4 items-center justify-center dark:bg-[#8A8A8A] rounded-md">
                           <Check className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                        <div className="flex h-4 w-4 items-center justify-center dark:bg-[#8A8A8A] rounded-md">
                          <Minus className="h-3.5 w-3.5 dark:text-black" />
                          </div>
                      )}
                    </div>
                    {mail?.bulkSelected?.length === threads?.length ? 
                      `All ${mail?.bulkSelected?.length} emails selected` : 
                      `${mail?.bulkSelected?.length} email${mail?.bulkSelected?.length === 1 ? '' : 's'} selected`}
                  </div>
                </div>
              )}
              <div className="w-full">
                <form id="ai-chat-form" onSubmit={handleSubmit} className="relative">
                  <Input
                    ref={inputRef}
                    readOnly={!chatMessages.enabled}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask AI to do anything..."
                    className="placeholder:text-muted-foreground h-8 w-full resize-none rounded-lg bg-white px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#202020]"
                  />
                  {status === 'ready' ? (
                    <button
                      form="ai-chat-form"
                      type="submit"
                      className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg"
                      disabled={!input.trim() || !chatMessages.enabled}
                    >
                      <div className="dark:bg[#141414] flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1">
                        <CurvedArrow className="mt-1.5 h-4 w-4 fill-black dark:fill-[#929292]" />
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={stop}
                      type="button"
                      className="absolute right-1 top-1/2 inline-flex h-6 -translate-y-1/2 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg"
                    >
                      <div className="dark:bg[#141414] flex h-5 items-center justify-center gap-1 rounded-sm bg-black/10 px-1">
                        <Stop className="h-4 w-4 fill-black dark:fill-[#929292]" />
                      </div>
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
