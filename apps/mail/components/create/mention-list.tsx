import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: Array<{
    id: string;
    name: string;
    description?: string;
    avatar?: string;
    logo?: string;
  }>;
  command: (item: { id: string; name: string }) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, name: item.name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md">
        <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">No tools found</div>
      </div>
    );
  }

  return (
    <div className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md">
      {props.items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            'focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
            index === selectedIndex && 'bg-accent text-accent-foreground'
          )}
          onClick={() => selectItem(index)}
        >
          <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
            {item.logo ? (
              <div 
                className="w-4 h-4 text-muted-foreground" 
                dangerouslySetInnerHTML={{ __html: item.logo }}
              />
            ) : item.avatar ? (
              <img
                src={item.avatar}
                alt={item.name}
                className="h-4 w-4 rounded-full"
              />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {item.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium">{item.name}</span>
              {item.description && (
              <span className="text-xs text-muted-foreground">
                {item.description}
              </span>
              )}
          </div>
        </div>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList'; 