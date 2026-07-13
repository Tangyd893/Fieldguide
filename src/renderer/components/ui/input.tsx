import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[var(--fg-input-border)] bg-[var(--fg-input-bg)] px-3 py-1 text-sm text-[var(--fg-input-text)] shadow-sm transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--fg-input-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-accent)] disabled:cursor-not-allowed disabled:bg-[var(--fg-input-disabled-bg)] disabled:text-[var(--fg-input-disabled-text)]',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
