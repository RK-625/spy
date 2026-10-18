import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useMemo } from 'react'
import type { CSSProperties, ElementType } from 'react'
import { cn } from '~/lib/utils'

export interface ShimmerProps {
  children: string
  as?: ElementType
  className?: string
  duration?: number
  spread?: number
  active?: boolean
}

const ShimmerComponent = ({
  children,
  as: Component = 'p',
  className,
  duration = 2,
  spread = 2,
  active = true,
}: ShimmerProps) => {
  const dynamicSpread = useMemo(
    () => children.length * spread,
    [children, spread],
  )

  const reducedMotion = useReducedMotion()
  return (
    <Component className={cn('relative inline-block', className)}>
      {/* Static text base layer */}
      <span className="opacity-100">{children}</span>

      {/* Animated shimmer overlay */}
      <AnimatePresence>
        {active && !reducedMotion && (
          <motion.span
            aria-hidden="true"
            animate={{ opacity: 1, backgroundPosition: '0% center' }}
            className={cn(
              'absolute inset-0 block bg-[length:250%_100%,auto] bg-clip-text !text-transparent',
              '[--bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--color-background),transparent_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]',
            )}
            initial={{ opacity: 0, backgroundPosition: '100% center' }}
            exit={{ opacity: 0 }}
            style={
              {
                '--spread': `${dynamicSpread}px`,
                backgroundImage:
                  'var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))',
              } as CSSProperties
            }
            transition={{
              opacity: { duration: 0.4 },
              backgroundPosition: {
                duration,
                ease: 'linear',
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </Component>
  )
}

export const Shimmer = memo(ShimmerComponent)
