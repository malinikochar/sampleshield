'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'amber' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#0E9488] text-white hover:bg-[#0B7A70] shadow-xs border border-transparent',
      secondary:
        'bg-[#183B56] text-white hover:bg-[#142437] shadow-xs border border-transparent',
      outline:
        'bg-white text-[#142437] border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
      danger:
        'bg-[#C63F3B] text-white hover:bg-[#A6312D] shadow-xs border border-transparent',
      amber:
        'bg-[#FEF3C7] text-[#78350F] border border-[#F59E0B]/50 hover:bg-[#FDE68A]',
      ghost:
        'bg-transparent text-[#142437] hover:bg-slate-200/60 border border-transparent',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'min-h-9 px-3 py-1.5 text-xs font-medium rounded-lg',
      md: 'min-h-11 px-4 py-2.5 text-sm font-semibold rounded-xl',
      lg: 'min-h-12 px-5 py-3 text-base font-semibold rounded-xl',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(20,36,55,0.04)]',
        className
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437] placeholder:text-slate-400 transition-colors focus:border-[#0E9488] disabled:bg-slate-100 disabled:text-slate-500',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#142437] placeholder:text-slate-400 transition-colors focus:border-[#0E9488] disabled:bg-slate-100 disabled:text-slate-500',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function FieldLabel({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn('block text-sm font-semibold text-[#142437] mb-1.5', className)}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-1 text-[#C63F3B]" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#142437]/50 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <DialogPrimitive.Title className="text-lg font-bold text-[#142437]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-slate-600 mt-1">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#142437]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
