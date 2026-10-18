/**
 * PromptInputButton: footer tool button with optional tooltip.
 */

import { Children } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { InputGroupButton } from '~/components/ui/forms/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/overlays/tooltip'
import { cn } from '~/lib/utils'

export type PromptInputButtonTooltip =
  | string
  | {
      content: ReactNode
      shortcut?: string
      side?: ComponentProps<typeof TooltipContent>['side']
    }

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
  tooltip?: PromptInputButtonTooltip
}

export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size,
  tooltip,
  ...props
}: PromptInputButtonProps) => {
  const resolvedSize =
    size ?? (Children.count(props.children) > 1 ? 'sm' : 'icon-sm')

  const button = (
    <InputGroupButton
      className={cn('rounded-[var(--radius)]', className)}
      size={resolvedSize}
      type="button"
      variant={variant}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  const tooltipContent = typeof tooltip === 'string' ? tooltip : tooltip.content
  const shortcut = typeof tooltip === 'string' ? undefined : tooltip.shortcut
  const side = typeof tooltip === 'string' ? 'top' : (tooltip.side ?? 'top')

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={side}>
        {tooltipContent}
        {shortcut && (
          <span className="ml-2 text-muted-foreground">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
