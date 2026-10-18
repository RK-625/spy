import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  createContext,
  isValidElement,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { ChevronDown, CornerDownLeft, Globe, Lightbulb } from 'lucide-react'
import { Shimmer } from './shimmer'
import { LOADING_PHRASES } from './loading-phrases'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '~/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/ui/layout/collapsible'

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChainOfThoughtContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  contentId: string
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null,
)

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext)
  if (!context) {
    throw new Error(
      'ChainOfThought components must be used within ChainOfThought',
    )
  }
  return context
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export type ChainOfThoughtProps = ComponentProps<'div'> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isStreaming?: boolean
  /** Total steps count for the header badge */
  stepCount?: number
}

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    isStreaming = false,
    stepCount,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    })

    const contentId = useId()
    const ctx = useMemo(
      () => ({ isOpen, setIsOpen, contentId }),
      [isOpen, setIsOpen, defaultOpen, contentId],
    )

    return (
      <ChainOfThoughtContext.Provider value={ctx}>
        <div className={cn('not-prose mb-2 w-full', className)} {...props}>
          {/* Header trigger */}
          <ChainOfThoughtHeader
            isStreaming={isStreaming}
            stepCount={stepCount}
          />
          {/* Steps body */}
          <ChainOfThoughtContent>{children}</ChainOfThoughtContent>
        </div>
      </ChainOfThoughtContext.Provider>
    )
  },
)

// ─── Header ───────────────────────────────────────────────────────────────────

type ChainOfThoughtHeaderProps = {
  isStreaming?: boolean
  stepCount?: number
  className?: string
}

const ChainOfThoughtHeader = memo(
  ({ isStreaming, stepCount, className }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen, contentId } = useChainOfThought()
    const [phraseIndex, setPhraseIndex] = useState(0)
    useEffect(() => {
      if (!isStreaming) return
      const interval = setInterval(() => {
        setPhraseIndex(Math.floor(Math.random() * LOADING_PHRASES.length))
      }, 7500)
      return () => clearInterval(interval)
    }, [isStreaming])
    const displayText = isStreaming ? LOADING_PHRASES[phraseIndex] : 'REASONING'
    return (
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group flex w-full items-center gap-2 text-sm transition-colors',
          'text-lavender-muted hover:text-primary',
          className,
        )}
      >
        {/* Pixel brain icon */}
        <Lightbulb
          size={14}
          strokeWidth={1.5}
          className="shrink-0 opacity-70"
        />
        <Shimmer
          as="div"
          active={isStreaming}
          className="text-left font-[family-name:var(--font-terminal)] text-[0.9rem] tracking-widest uppercase transition-colors"
        >
          {displayText}
        </Shimmer>
        {stepCount !== undefined && stepCount > 0 && (
          <span className="rounded-full bg-[var(--pill-status-bg)] px-2 py-0.5 font-[family-name:var(--font-terminal)] text-[0.6rem] text-[var(--pill-status-text)] tracking-widest">
            {stepCount} steps
          </span>
        )}

        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            'shrink-0 transition-transform duration-200 opacity-50',
            isOpen ? 'rotate-180' : 'rotate-0',
          )}
        />
      </button>
    )
  },
)

// ─── Content wrapper ──────────────────────────────────────────────────────────

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen, contentId } = useChainOfThought()

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          id={contentId}
          className={cn(
            'px-2 space-y-0',
            'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
            className,
          )}
          {...props}
        >
          {/* Top divider */}
          <div className="mb-3 mt-1 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent" />
          {children}
        </CollapsibleContent>
      </Collapsible>
    )
  },
)

// ─── Step ─────────────────────────────────────────────────────────────────────

export type ChainOfThoughtStepStatus = 'active' | 'complete' | 'pending'

export type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  icon?: LucideIcon | ReactNode
  label: ReactNode
  description?: ReactNode
  status?: ChainOfThoughtStepStatus
  isLast?: boolean
}

const stepIconColors: Record<ChainOfThoughtStepStatus, string> = {
  active: 'text-lavender',
  complete: 'text-text-secondary',
  pending: 'text-text-dim',
}

const stepLabelColors: Record<ChainOfThoughtStepStatus, string> = {
  active: 'text-primary',
  complete: 'text-lavender-muted',
  pending: 'text-text-dim',
}

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon = CornerDownLeft,
    label,
    description,
    status = 'complete',
    isLast = false,
    children,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div
      className={cn(
        'relative flex gap-3 text-sm',
        'fade-in-0 slide-in-from-top-2 animate-in duration-300',
        className,
      )}
      {...props}
    >
      {/* Icon + connector line */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
            'border border-[var(--border-default)] bg-[var(--surface-elevated)]/80',
            stepIconColors[status],
          )}
        >
          {isValidElement(icon)
            ? icon
            : (() => {
                const Icon = icon as LucideIcon
                return <Icon size={10} strokeWidth={1.5} />
              })()}
        </div>
        {/* Vertical connector — always draw unless isLast */}
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-gradient-to-b from-[var(--thread-line)] to-transparent" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 space-y-2 overflow-hidden pb-4',
          isLast && 'pb-0',
        )}
      >
        <div className={cn('leading-snug', stepLabelColors[status])}>
          {label}
        </div>
        {description && (
          <div className="text-[0.7rem] text-text-dim">{description}</div>
        )}
        {children}
      </div>
    </div>
  ),
)

// ─── Search Results (URL badges) ──────────────────────────────────────────────

export type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div
      className={cn('flex flex-wrap items-center gap-1.5 mt-1.5', className)}
      {...props}
    />
  ),
)

export type ChainOfThoughtSearchResultProps = ComponentProps<'a'> & {
  favicon?: string
}

function hostnameFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export const ChainOfThoughtSearchResult = memo(
  ({
    className,
    children,
    href,
    favicon,
    ...props
  }: ChainOfThoughtSearchResultProps) => {
    const domain = hostnameFromHref(href)

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1',
          'border border-[var(--pill-source-border)] bg-[var(--pill-source-bg)]',
          'font-[family-name:var(--font-body)] text-[0.65rem] text-[var(--pill-source-text)]',
          'transition-colors hover:border-[var(--pill-source-border-hover)] hover:text-[var(--pill-source-text-hover)]',
          className,
        )}
        {...props}
      >
        {favicon ? (
          <img src={favicon} alt="" className="size-3 rounded-full" />
        ) : (
          <Globe size={9} strokeWidth={1.5} className="opacity-60" />
        )}
        <span>{children ?? domain}</span>
      </a>
    )
  },
)

// ─── Display names ────────────────────────────────────────────────────────────

ChainOfThought.displayName = 'ChainOfThought'
ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader'
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent'
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep'
ChainOfThoughtSearchResults.displayName = 'ChainOfThoughtSearchResults'
ChainOfThoughtSearchResult.displayName = 'ChainOfThoughtSearchResult'
