/**
 * PromptInputBody: optional pending-ask chrome + children (typically textarea).
 */

import { X } from 'lucide-react'
import { useId } from 'react'
import { PromptInputButton } from '../footer/button'
import { PromptInputOption, PromptInputQuestion } from '../ask/pending-ask'
import type { PendingAskUserQuestion } from '../../ask-user-question'
import type { HTMLAttributes } from 'react'
import type { PromptInputAskOption } from '../ask/pending-ask'
import { cn } from '~/lib/utils'
import { ICON_GLYPH } from '~/styles/tokens/icons'

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement> & {
  pendingAsk?: PendingAskUserQuestion | null
  onAskDismiss?: () => void
  askDismissDisabled?: boolean
  onOptionSelect?: (option: PromptInputAskOption) => void
}

export const PromptInputBody = ({
  className,
  children,
  pendingAsk = null,
  onOptionSelect,
  onAskDismiss,
  askDismissDisabled = false,
  ...props
}: PromptInputBodyProps) => {
  const questionId = useId()
  const hasPendingAsk = pendingAsk != null
  const questionText = pendingAsk?.question.trim() ?? ''
  const options = pendingAsk?.options ?? []
  const showQuestion = hasPendingAsk && questionText.length > 0
  const showOptions = hasPendingAsk && options.length > 0
  // Options-only when custom write-in is disallowed.
  const showTextarea = pendingAsk == null || pendingAsk.allowCustomInput

  return (
    /* Body owns H gutter (tokens --prompt-body-px/py); leaves have no horizontal pad. */
    <div
      className={cn(
        'flex w-full min-w-0 px-prompt-body-x py-prompt-body-y',
        className,
      )}
      {...props}
    >
      {/* Thin shell: layout only (`flex-col gap-2` when pending-ask) — no pad.
          Pending-ask column aligns at Body content edge. */}
      <div
        className={cn('w-full min-w-0', hasPendingAsk && 'flex flex-col gap-2')}
      >
        {showQuestion ? (
          <div className="flex items-start gap-2">
            <PromptInputQuestion id={questionId}>
              {questionText}
            </PromptInputQuestion>
            {onAskDismiss ? (
              <PromptInputButton
                onClick={onAskDismiss}
                disabled={askDismissDisabled}
                aria-label="Dismiss question"
                tooltip="Dismiss question"
              >
                <X size={ICON_GLYPH.inline} strokeWidth={1.5} />
              </PromptInputButton>
            ) : null}
          </div>
        ) : null}
        {showOptions ? (
          <div
            className="flex max-h-48 min-h-0 flex-col gap-1 overflow-y-auto"
            data-slot="prompt-input-options"
            role="group"
            {...(showQuestion
              ? { 'aria-labelledby': questionId }
              : { 'aria-label': 'Options' })}
          >
            {options.map((option) => (
              <PromptInputOption
                key={option.id}
                option={option}
                disabled={askDismissDisabled}
                onSelect={onOptionSelect}
              />
            ))}
          </div>
        ) : null}
        {/* Keep the editor mounted while a forced choice temporarily hides it. */}
        <div hidden={!showTextarea}>{children}</div>
      </div>
    </div>
  )
}
