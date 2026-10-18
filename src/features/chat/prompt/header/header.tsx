/**
 * PromptInputHeader: block-start InputGroupAddon for attachment strip etc.
 */

import { Children } from 'react'
import type { ComponentProps } from 'react'
import { InputGroupAddon } from '~/components/ui/forms/input-group'
import { cn } from '~/lib/utils'

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  'align'
>

export const PromptInputHeader = ({
  className,
  children,
  ...props
}: PromptInputHeaderProps) => {
  if (Children.count(children) === 0) {
    return null
  }

  return (
    <InputGroupAddon
      align="block-start"
      className={cn(
        'flex-col gap-0 items-start w-full px-0 pt-0 pb-0',
        className,
      )}
      {...props}
    >
      {children}
    </InputGroupAddon>
  )
}
