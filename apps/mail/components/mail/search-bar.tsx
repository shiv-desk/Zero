import { parseNaturalLanguageSearch, parseNaturalLanguageDate, formatDate, cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useThreads, useThread } from '@/hooks/use-threads';
import { useSearchValue } from '@/hooks/use-search-value';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect, useCallback } from 'react';
import { type DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { usePathname } from 'next/navigation';
import type { ParsedMessage, Label } from '@/types';
import { getEmailLogo } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Button } from '../ui/button';
import { useQueryState } from 'nuqs';
import { format } from 'date-fns';
import React from 'react';
import { X } from '../icons/icons';
import { highlightText } from '@/lib/email-utils.client';
import { RenderLabels } from './render-labels';
import { useMail } from '@/components/mail/use-mail';
import { GroupPeople } from '../icons/icons';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
  has: any;
  fileName: any;
  deliveredTo: string;
  unicorn: string;
};

interface ThreadData {
  latest?: ParsedMessage;
  hasUnread?: boolean;
  totalReplies?: number;
  labels?: Array<{
    id: string;
    name: string;
    type?: string;
    color?: {
      backgroundColor: string;
      textColor: string;
    };
  }>;
}


function ThreadPreview({ thread }: { thread: { id: string } }) {
  const { data: threadData } = useThread(thread.id) as { data: ThreadData | undefined };
  const latestMessage = threadData?.latest;
  const [searchValue] = useSearchValue();
  const isGroupThread = threadData?.totalReplies && threadData.totalReplies > 1;

  if (!latestMessage || !threadData) return null;

  const cleanNameDisplay = (name?: string) => {
    if (!name) return '';
    const match = name.match(/^[^a-zA-Z0-9.]*(.*?)[^a-zA-Z0-9.]*$/);
    return match ? match[1] : name;
  };

  const stripImagesKeepText = (content?: string) => {
    if (!content) return null;
    const strippedContent = content
      .replace(/ERROR/g, '')
      .replace(/<img[^>]*>/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\b(undefined|null)\b/g, '')
      .trim();
    return strippedContent.length >= 2 && /[a-zA-Z]{2,}/.test(strippedContent) ? strippedContent : null;
  };

  // Convert thread labels to the correct format with required type field
  const threadLabels = threadData.labels?.map(label => ({
    id: label.id,
    name: label.name,
    type: label.type || 'user',
    color: label.color
  })) as Label[];

  return (
    <div className="select-none">
      <div
        className={cn(
          'hover:bg-offsetLight hover:bg-primary/5 relative mx-2 flex cursor-pointer flex-col items-start rounded-lg border-transparent py-2 text-left text-sm transition-all',
          'relative',
        )}
      >
        <div className="flex w-full items-center justify-between gap-4 px-4 pl-5">
          <div className={cn('relative flex w-full items-center', threadData.hasUnread ? '' : 'opacity-70')}>
            {/* Status Indicator */}
            <div className="flex-shrink-0 mr-4">
              <div className="relative">
                {threadData.hasUnread ? (
                  <span className="absolute right-0.5 top-[-3px] size-2 rounded bg-[#006FFE]" />
                ) : (
                  <span className={cn(`absolute right-0.5 top-[-3px] size-2 rounded bg-black/40 dark:bg-[#2C2C2C]`)} />
                )}
              </div>
            </div>

            {/* Sender Name/Subject */}
            <div className="flex-shrink-0 w-[100px] min-w-[100px] flex items-center">
              <span className="line-clamp-1 text-sm font-medium min-w-0">
                {highlightText(cleanNameDisplay(latestMessage.sender.name) || '', searchValue.highlight)}
              </span>
              {/* <div className="flex-shrink-0">
                {threadLabels && threadLabels.length > 0 && <RenderLabels labels={threadLabels} />}
              </div> */}
            </div>

            {/* Avatar */}
            <div className="flex-shrink-0 mx-4">
              <Avatar className="h-5 w-5 rounded border dark:border-none">
                {isGroupThread ? (
                  <div className="flex h-full w-full items-center justify-center rounded bg-[#FFFFFF] dark:bg-[#373737]">
                    <GroupPeople className="h-3 w-3" />
                  </div>
                ) : (
                  <>
                    <AvatarImage
                      className="rounded bg-[#FFFFFF] dark:bg-[#373737]"
                      src={getEmailLogo(latestMessage.sender.email)}
                    />
                    <AvatarFallback className="rounded bg-[#FFFFFF] text-xs font-bold text-[#9F9F9F] dark:bg-[#373737]">
                      {latestMessage.sender.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
            </div>

            {/* Divider */}
            <div className="flex-shrink-0 mx-4 h-4 w-[0.1px] bg-black/20 dark:bg-[#2C2C2C]" />

            {/* Subject */}
            <div className="flex-shrink-0 w-[420px] min-w-[250px]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center">
                  {/* {threadLabels && threadLabels.length >= 1 ? (
                    <span className="flex items-center space-x-2 mr-2">
                      <RenderLabels labels={threadLabels} />
                    </span>
                  ) : null} */}
                  <p className="line-clamp-1 text-sm dark:text-white text-black">
                    {highlightText(latestMessage.subject, searchValue.highlight)}
                  </p>
                </div>
                {threadData?.totalReplies && threadData.totalReplies > 1 && (
                  <span className="text-xs text-[#6D6D6D] dark:text-[#8C8C8C]">
                    {threadData.totalReplies}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex-shrink-0 mx-4 h-4 w-[0.1px] bg-black/20 dark:bg-[#2C2C2C]" />

            {/* Message Title */}
            {/* <div className="flex-1 w-[50px] min-w-[50px]">
              <p className="line-clamp-1 text-sm text-[#8C8C8C]">
                {stripImagesKeepText(latestMessage.title) || ''}
              </p>
            </div> */}

            {/* Divider */}
            {/* <div className="flex-shrink-0 mx-4 h-4 w-[0.1px] bg-black/20 dark:bg-[#2C2C2C]" /> */}

            {/* Date */}
            <div className="flex-shrink-0 text-right w-16">
              {latestMessage.receivedOn && (
                <p className="text-nowrap text-xs font-normal text-[#6D6D6D] dark:text-[#8C8C8C]">
                  {formatDate(latestMessage.receivedOn.split('.')[0] || '')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const trpc = useTRPC();
  const [, setThreadId] = useQueryState('threadId');
  const { resolvedTheme } = useTheme();
  const t = useTranslations();
  
  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(localSearchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [localSearchQuery]);
  
  // Use debounced query for search
  const { data: searchResults, isLoading } = useQuery(
    trpc.mail.listThreads.queryOptions(
      {
        q: debouncedQuery,  // Use debounced query instead of direct input
        folder: '', 
      },
      {
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 60,
      }
    )
  );

  // Get all matching threads
  const matchingThreads = searchResults?.threads || [];

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setLocalSearchQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  const handleThreadClick = useCallback(
    (threadId: string) => {
      setThreadId(threadId);
      onOpenChange(false);
    },
    [setThreadId, onOpenChange],
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchQuery(e.target.value);
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-4 mt-44">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#8b5cf6]"></div>
        </div>
      );
    }

    if (!localSearchQuery) {
      return (
        <div className="flex h-[300px] w-full items-center justify-center mt-12">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Image
              suppressHydrationWarning
              src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
              alt="No Results"
              width={150}
              height={150}
            />
            <div className="mt-2">
              <p className="text-lg text-muted-foreground/60">Search your emails</p>
              <p className="text-sm text-muted-foreground/50">
                Start typing to search across all your emails
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (matchingThreads.length === 0) {
      return (
        <div className="flex h-[300px] w-full items-center justify-center mt-12">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Image
              suppressHydrationWarning
              src={resolvedTheme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
              alt="No Results"
              width={150}
              height={150}
            />
            <div className="mt-5">
              <p className="text-lg">No results found</p>
              <p className="text-md text-[#6D6D6D] dark:text-white/50">
                Try searching with different keywords
              </p>
            </div>
          </div>
        </div>
      );
    }

    return matchingThreads.map((thread) => (
      <div key={thread.id} className="py-2" onClick={() => handleThreadClick(thread.id)}>
        <ThreadPreview thread={thread} />
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl px-0 pt-0" showOverlay>
        <DialogHeader>
          <DialogTitle></DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between border-b py-1 pl-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1 bg-[#FAFAFA] dark:bg-[#262626] rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="fill-muted-foreground relative top-[1px] h-3.5 w-3.5" />
            <p className="text-sm text-muted-foreground">esc</p>
          </button>
          <Input
            placeholder="Search in all emails..."
            value={localSearchQuery}
            onChange={handleSearchChange}
            className="border-none pl-3 pr-4"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[400px] pr-4">
          {renderContent()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function SearchBar() {
  // Changed default to false
  const [open, setOpen] = useState(false);
  const [, setSearchValue] = useSearchValue();
  const pathname = usePathname();

  const form = useForm<SearchForm>({
    defaultValues: {
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    },
  });

  useEffect(() => {
    if (pathname !== '/mail/inbox') {
      resetSearch();
    }
  }, [pathname]);

  const resetSearch = useCallback(() => {
    form.reset({
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    });
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
      isLoading: false,
      isAISearching: false,
    });
  }, [form, setSearchValue]);

  return (
    <div className="relative flex-1">
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        className="h-7 w-7 px-1.5 dark:bg-[#2C2C2C] [&>svg]:h-4 [&>svg]:w-4"
      >
        <Search className="dark:text-iconDark text-iconLight" />
      </Button>

      <SearchDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function extractMetaText(text: string) {
  // Check if the text contains a query enclosed in quotes
  const quotedQueryMatch = text.match(/["']([^"']+)["']/);
  if (quotedQueryMatch && quotedQueryMatch[1]) {
    // Return just the content inside the quotes
    return quotedQueryMatch[1].trim();
  }

  // Check for common patterns where the query is preceded by explanatory text
  const patternMatches = [
    // Match "Here is the converted query:" pattern
    text.match(/here is the (converted|enhanced) query:?\s*["']?([^"']+)["']?/i),
    // Match "The search query is:" pattern
    text.match(/the (search query|query) (is|would be):?\s*["']?([^"']+)["']?/i),
    // Match "I've converted your query to:" pattern
    text.match(/i('ve| have) converted your query to:?\s*["']?([^"']+)["']?/i),
    // Match "Converting to:" pattern
    text.match(/converting to:?\s*["']?([^"']+)["']?/i),
  ].filter(Boolean);

  if (patternMatches.length > 0 && patternMatches[0]) {
    // Return the captured query part (last capture group)
    const match = patternMatches[0];

    if (!match[match.length - 1]) return;

    return match[match.length - 1]!.trim();
  }

  // If no patterns match, remove common explanatory text and return
  let cleanedText = text
    // Remove "I focused on..." explanations
    .replace(/I focused on.*$/im, '')
    // Remove "Here's a precise..." explanations
    .replace(/Here's a precise.*$/im, '')
    // Remove any explanations after the query
    .replace(/\n\nThis (query|search).*$/im, '')
    // Remove any explanations before the query
    .replace(/^.*?(from:|to:|subject:|is:|has:|after:|before:)/i, '$1')
    // Clean up any remaining quotes
    .replace(/["']/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText;
}
