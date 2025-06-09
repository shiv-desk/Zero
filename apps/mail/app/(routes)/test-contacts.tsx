// TODO: DELETE ONCE DONE

import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface Contact {
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  source: 'google' | 'email';
}

export default function TestContact() {
  const trpc = useTRPC();

  const {
    data: googleContacts,
    isLoading: isLoadingGoogleContacts,
    isError: isGoogleError,
  } = useQuery(trpc.mail.getUsersContacts.queryOptions(void 0));

  const {
    data: emailContacts,
    isLoading: isLoadingEmailContacts,
    isError: isEmailError,
  } = useQuery(trpc.mail.getAllEmailContacts.queryOptions(void 0));

  const combinedContacts = useMemo(() => {
    const contactMap = new Map<string, Contact>();

    if (googleContacts) {
      googleContacts.forEach((contact) => {
        if (contact.email) {
          const email = contact.email.toLowerCase();
          contactMap.set(email, {
            name: contact.name || contact.email,
            email: contact.email,
            phone: contact.phone,
            photo: contact.photo,
            source: 'google',
          });
        }
      });
    }

    if (emailContacts) {
      emailContacts.forEach((contact) => {
        if (contact.email) {
          const email = contact.email.toLowerCase();
          const existing = contactMap.get(email);

          if (!existing) {
            contactMap.set(email, {
              name: contact.name || contact.email,
              email: contact.email,
              source: 'email',
            });
          } else if (
            existing.source === 'google' &&
            existing.name === existing.email &&
            contact.name
          ) {
            contactMap.set(email, {
              ...existing,
              name: contact.name,
            });
          }
        }
      });
    }

    return Array.from(contactMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [googleContacts, emailContacts]);

  const isLoading = isLoadingGoogleContacts || isLoadingEmailContacts;
  const isError = isGoogleError || isEmailError;

  return (
    <div className="rounded-inherit relative z-[5] flex h-full w-full p-0">
      <ResizablePanelGroup direction="horizontal" className="rounded-inherit overflow-hidden">
        <ResizablePanel
          className={cn(
            `bg-panelLight dark:bg-panelDark w-fit shadow-sm md:m-1 md:rounded-2xl md:border md:border-[#E7E7E7] lg:flex lg:shadow-sm dark:border-[#252525]`,
          )}
        >
          <div className="h-svh w-full md:h-[calc(100dvh-10px)]">
            <div className="flex h-full w-full flex-col items-center justify-center pb-2 pt-4">
              <h2 className="mb-2 text-lg font-semibold">All Contacts</h2>
              <div className="text-muted-foreground mb-2 text-sm">
                Total: {combinedContacts.length} contacts
              </div>
              {isLoading ? (
                <div className="flex h-[calc(100dvh-88px)] w-full items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Loading contacts...</span>
                </div>
              ) : isError ? (
                <div className="h-[calc(100dvh-88px)] w-full">
                  <div className="text-red-500">Error loading contacts</div>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100dvh-88px)] w-full overflow-hidden">
                  <div className="px-2">
                    <ul className="space-y-1">
                      {combinedContacts.map((contact) => (
                        <li
                          key={contact.email}
                          className="hover:bg-muted rounded-xl p-3 transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center text-sm font-medium">
                              {contact.name || 'No name'}
                            </span>
                            <span className="text-muted-foreground text-sm">{contact.email}</span>
                            {contact.phone && (
                              <span className="text-muted-foreground text-sm">{contact.phone}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
