/**
 * PromptInputFooter: block-end InputGroupAddon for tools + submit.
 */

import type { ComponentProps } from 'react'
import { InputGroupAddon } from '~/components/ui/forms/input-group'
import { cn } from '~/lib/utils'

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  'align'
>

export const PromptInputFooter = ({
  className,
  children,
  ...props
}: PromptInputFooterProps) => {
  return (
    <InputGroupAddon
      data-prompt-footer
      align="block-end"
      className={cn('justify-between gap-1', className)}
      {...props}
    >
      {children}
    </InputGroupAddon>
  )
}
