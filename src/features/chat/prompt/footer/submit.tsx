/**
 * PromptInputSubmit: submit / stop control with status glyph animation.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback } from 'react'
import type { ChatStatus } from 'ai'
import type { ComponentProps, MouseEvent } from 'react'
import { MOTION } from '~/styles/tokens/motion'
import { InputGroupButton } from '~/components/ui/forms/input-group'
import { DotmHex9 } from '~/components/brand/dotmatrix/loaders/hex-9'
import { DotmTriangle16 } from '~/components/brand/dotmatrix/loaders/triangle-16'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { cn } from '~/lib/utils'

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus
  onStop?: () => void
}

export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon-sm',
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const reducedMotion = useReducedMotion()
  const isGenerating = status === 'submitted' || status === 'streaming'

  const iconKey = status || 'ready'
  let Icon = (
    <DotmTriangle16
      size={ICON_GLYPH.toolbar}
      dotSize={2}
      dotShape="square"
      color="currentColor"
      animated={status === 'submitted'}
    />
  )

  if (status === 'streaming') {
    Icon = (
      <DotmHex9
        size={ICON_GLYPH.toolbar}
        dotSize={2.5}
        dotShape="square"
        color="currentColor"
        animated={true}
      />
    )
  }

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (isGenerating && onStop) {
        e.preventDefault()
        onStop()
        return
      }
      onClick?.(e)
    },
    [isGenerating, onStop, onClick],
  )

  return (
    <InputGroupButton
      aria-label={isGenerating ? 'Stop' : 'Submit'}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? 'button' : 'submit'}
      variant={variant}
      {...props}
    >
      {children ?? (
        <AnimatePresence mode="wait">
          <motion.div
            key={iconKey}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
            aria-hidden
            className="flex items-center justify-center"
          >
            {Icon}
          </motion.div>
        </AnimatePresence>
      )}
    </InputGroupButton>
  )
}
