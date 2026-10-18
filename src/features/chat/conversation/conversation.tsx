import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback } from 'react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import type { ComponentProps } from 'react'
import { Button } from '~/components/ui/actions/button'
import { cn } from '~/lib/utils'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { DotmTriangle16 } from '~/components/brand/dotmatrix/loaders/triangle-16'

export type ConversationProps = ComponentProps<typeof StickToBottom>

export const Conversation = ({ className, ...props }: ConversationProps) => {
  const reducedMotion = useReducedMotion()
  return (
    <StickToBottom
      className={cn('relative min-h-0 flex-1 overflow-y-hidden', className)}
      initial={reducedMotion ? 'instant' : 'smooth'}
      resize={reducedMotion ? 'instant' : 'smooth'}
      role="log"
      {...props}
    />
  )
}

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn(
      'mx-auto flex w-full max-w-4xl flex-col gap-6 p-4',
      className,
    )}
    {...props}
  />
)

export type ConversationScrollButtonProps = ComponentProps<typeof Button>

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const reducedMotion = useReducedMotion()
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom({ animation: reducedMotion ? 'instant' : 'smooth' })
  }, [scrollToBottom, reducedMotion])

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 8, scale: 0.95, x: '-50%' }}
          transition={{
            duration: reducedMotion ? 0 : 0.25,
            ease: [0.2, 0.8, 0.2, 1],
          }}
          className="absolute bottom-4 left-[50%] z-30"
        >
          <Button
            className={cn(
              '!size-8 !rounded-[var(--radius)] transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              'bg-primary text-accent-ink hover:bg-primary-hover',
              className,
            )}
            aria-label="Scroll to latest message"
            data-slot="scroll-button"
            onClick={handleScrollToBottom}
            size="icon"
            type="button"
            variant="default"
            {...props}
          >
            <span aria-hidden>
              <DotmTriangle16
                size={ICON_GLYPH.toolbar}
                dotSize={2}
                dotShape="square"
                color="currentColor"
                animated={false}
                ariaLabel="Latest message"
                className="rotate-180"
              />
            </span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
