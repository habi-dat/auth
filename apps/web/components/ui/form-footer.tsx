'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface FormFooterProps {
  /** Loading state for submit button */
  isLoading?: boolean
  /** Whether the form is in editing mode (shows "Save" vs "Create" and "Delete") */
  isEditing?: boolean
  /** Label for submit button (defaults to "save" or "create" based on isEditing) */
  submitLabel?: string
  /** Label for cancel button (defaults to "cancel") */
  cancelLabel?: string
  /** URL to redirect to on cancel (if provided, Cancel will be a Link) */
  cancelHref?: string
  /** Action to perform on cancel (if no cancelHref) */
  onCancel?: () => void
  /** Action to perform on delete (if provided, shows a Delete button) */
  onDelete?: () => void
  /** Label for delete button (defaults to "delete") */
  deleteLabel?: string
  /** Additional class names for the container */
  className?: string
  /** Additional elements to show on the left next to cancel/delete */
  leftSection?: ReactNode
  /** Whether the submit button should be disabled */
  submitDisabled?: boolean
}

export function FormFooter({
  isLoading,
  isEditing,
  submitLabel,
  cancelLabel,
  cancelHref,
  onCancel,
  onDelete,
  deleteLabel,
  className = 'flex justify-between items-center',
  leftSection,
  submitDisabled,
}: FormFooterProps) {
  const tCommon = useTranslations('common')
  const defaultSubmitLabel = isEditing ? tCommon('save') : tCommon('create')
  const defaultCancelLabel = tCommon('cancel')
  const defaultDeleteLabel = tCommon('remove') // or 'delete' if available in common

  const cancelButton = (
    <Button
      type="button"
      variant="outline"
      onClick={onCancel}
      disabled={isLoading || submitDisabled}
    >
      {cancelLabel || defaultCancelLabel}
    </Button>
  )

  return (
    <div className={`flex justify-between items-center ${className}`}>
      <div className="flex gap-2 items-center">
        {cancelHref ? <Link href={cancelHref}>{cancelButton}</Link> : cancelButton}

        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isLoading || submitDisabled}
          >
            {deleteLabel || defaultDeleteLabel}
          </Button>
        )}

        {leftSection}
      </div>

      <Button type="submit" disabled={isLoading || submitDisabled}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel || defaultSubmitLabel}
      </Button>
    </div>
  )
}
