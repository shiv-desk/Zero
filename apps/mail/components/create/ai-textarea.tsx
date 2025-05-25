import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onCommandEnter?: () => void;
}

const AITextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onCommandEnter, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate new height within bounds (18px is one line height)
      const newHeight = Math.min(Math.max(18, textarea.scrollHeight), 500);
      textarea.style.height = `${newHeight}px`;

      // Add scrolling if content exceeds max height
      textarea.style.overflowY = textarea.scrollHeight > 500 ? 'auto' : 'hidden';
    };

    useEffect(() => {
      // Set initial height
      adjustHeight();
    }, []);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      props.onInput?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle command/control + enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onCommandEnter?.();
      }
      props.onKeyDown?.(e);
    };

    return (
      <textarea
        className={cn(
          'placeholder:text-muted-foreground w-full bg-transparent px-4 flex items-center text-sm disabled:cursor-not-allowed disabled:opacity-50',
          'placeholder:animate-shine placeholder:bg-gradient-to-r placeholder:from-neutral-500 placeholder:via-neutral-300 placeholder:to-neutral-500 placeholder:bg-[length:200%_100%] placeholder:bg-clip-text placeholder:text-transparent',
          'border-0 focus:outline-none focus:ring-0 resize-none overflow-hidden min-h-[36px] max-h-[500px] leading-[18px] py-2',
          className,
        )}
        ref={(node) => {
          // Handle both the forwarded ref and our internal ref
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
          textareaRef.current = node;
        }}
        rows={1}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);

AITextarea.displayName = 'AITextarea';

export { AITextarea };
