/**
 * PromptInputTools: horizontal row for footer tool buttons.
 */

import type { HTMLAttributes } from 'react'
import { cn } from '~/lib/utils'

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTools = ({
  className,
  children,
  ...props
}: PromptInputToolsProps) => {
  return (
    <div
      data-prompt-tools
      className={cn('flex min-w-0 items-center gap-1', className)}
      {...props}
    >
      {children}
    </div>
  )
}
