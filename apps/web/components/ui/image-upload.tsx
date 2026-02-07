'use client'

import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface ImageUploadProps {
  /** Current image URL (if already uploaded) */
  value?: string | null
  /** Called when a file is selected for upload */
  onUpload: (file: File) => Promise<string | undefined>
  /** Called when remove button is clicked */
  onRemove?: () => Promise<void>
  /** Accepted file types (default: images) */
  accept?: string
  /** Max file size in bytes (default: 2MB) */
  maxSizeBytes?: number
  /** Label text */
  label?: string
  /** Help text shown below the upload area */
  hint?: string
  /** Disable the component */
  disabled?: boolean
  /** Additional classes */
  className?: string
  /** Preview size */
  size?: 'sm' | 'md' | 'lg'
  /** Cache buster for image URL */
  cacheKey?: string | number
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
}

const dropzoneSizeClasses = {
  sm: 'min-h-[80px]',
  md: 'min-h-[120px]',
  lg: 'min-h-[160px]',
}

export function ImageUpload({
  value,
  onUpload,
  onRemove,
  accept = '.png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp',
  maxSizeBytes = 2 * 1024 * 1024,
  label,
  hint,
  disabled = false,
  className,
  size = 'md',
  cacheKey,
}: ImageUploadProps) {
  const t = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      if (file.size > maxSizeBytes) {
        setError(t('fileTooLarge', { max: `${Math.round(maxSizeBytes / 1024 / 1024)}MB` }))
        return
      }

      setIsUploading(true)
      try {
        await onUpload(file)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('uploadFailed'))
      } finally {
        setIsUploading(false)
      }
    },
    [maxSizeBytes, onUpload, t]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      if (disabled || isUploading) return

      const file = e.dataTransfer.files[0]
      if (file?.type.startsWith('image/')) {
        handleFile(file)
      }
    },
    [disabled, handleFile, isUploading]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleRemove = async () => {
    if (!onRemove) return
    setIsRemoving(true)
    setError(null)
    try {
      await onRemove()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('removeFailed'))
    } finally {
      setIsRemoving(false)
    }
  }

  const imageUrl = value && cacheKey ? `${value}?v=${cacheKey}` : value

  const isDisabled = disabled || isUploading || isRemoving

  const inputId = label ? `image-upload-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      )}

      {value ? (
        // Preview mode
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted',
              sizeClasses[size]
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl!} alt="" className="h-full w-full object-contain" />
            {(isUploading || isRemoving) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('replace')}
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={isDisabled}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('remove')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Dropzone mode
        <button
          type="button"
          onClick={() => !isDisabled && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={isDisabled}
          className={cn(
            'group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors',
            dropzoneSizeClasses[size],
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10">
                <ImagePlus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{t('dropImageHere')}</p>
                <p className="text-xs text-muted-foreground">{t('orClickToBrowse')}</p>
              </div>
            </>
          )}
        </button>
      )}

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={isDisabled}
        className="sr-only"
        aria-label={label || t('uploadImage')}
      />

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
