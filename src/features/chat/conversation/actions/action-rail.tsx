import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, HTMLAttributes } from 'react'
import { MOTION } from '~/styles/tokens/motion'
import { Button } from '~/components/ui/actions/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/overlays/tooltip'
import { ICON_GLYPH } from '~/styles/tokens/icons'
import { cn } from '~/lib/utils'

export type ChatActionRailProps = HTMLAttributes<HTMLDivElement> & {
  reveal?: 'always' | 'hover'
}

export const ChatActionRail = ({
  reveal = 'always',
  className,
  ...props
}: ChatActionRailProps) => (
  <div
    role="group"
    aria-label="Message actions"
    className={cn(
      'flex h-6 w-fit items-center gap-0.5 bg-transparent',
      reveal === 'hover' &&
        'transition-opacity duration-150 ease-out [@media(pointer:fine)]:pointer-events-none [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover/bubble:pointer-events-auto [@media(pointer:fine)]:group-hover/bubble:opacity-100 [@media(pointer:fine)]:focus-within:pointer-events-auto [@media(pointer:fine)]:focus-within:opacity-100',
      className,
    )}
    {...props}
  />
)

export type ChatActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  label: string
  icon: LucideIcon
}

export const ChatActionButton = ({
  label,
  icon: Icon,
  className,
  type = 'button',
  ...props
}: ChatActionButtonProps) => {
  const reducedMotion = useReducedMotion()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={cn(
            'text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground',
            className,
          )}
          size="icon-xs"
          type={type}
          variant="ghost"
          {...props}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={Icon.displayName ?? label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={reducedMotion ? { duration: 0 } : MOTION.chrome}
              className="flex items-center justify-center"
            >
              <Icon
                size={ICON_GLYPH.badge}
                strokeWidth={1.5}
                className="cursor-default"
              />
            </motion.span>
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
