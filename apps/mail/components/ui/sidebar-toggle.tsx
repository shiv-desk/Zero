'use client';

import type { ComponentProps } from 'react';

import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PanelLeftOpen } from '../icons/icons';

export function SidebarToggle({ className }: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button onClick={toggleSidebar} variant="ghost" className={cn('h-7 w-7 px-1.5 dark:bg-[#2C2C2C] [&>svg]:h-4 [&>svg]:w-4', className)}>
      <PanelLeftOpen className='dark:fill-iconDark fill-iconLight' />
    </Button>
  );
}
