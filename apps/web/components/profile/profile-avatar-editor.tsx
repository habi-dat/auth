'use client'

import { Loader2, Trash2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRef, useState } from 'react'
import { AvatarCropDialog } from '@/components/profile/avatar-crop-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { UserAvatar } from '@/components/ui/user-avatar'
import { removeAvatarAction, uploadAvatarAction } from '@/lib/actions/avatar-actions'

const MAX_SIZE_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

interface ProfileAvatarEditorProps {
  name: string
  image?: string | null
  updatedAt?: Date | string | null
  onChanged: () => void
}

export function ProfileAvatarEditor({
  name,
  image,
  updatedAt,
  onChanged,
}: ProfileAvatarEditorProps) {
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const removeAction = useAction(removeAvatarAction, {
    onSuccess: () => {
      setRemoveOpen(false)
      toast({ title: t('avatarRemoved') })
      onChanged()
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('avatarRemoveFailed'),
      })
    },
  })

  const handlePick = (file: File) => {
    if (file.size > MAX_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: tCommon('fileTooLarge', { max: '2MB' }),
      })
      return
    }
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('avatarInvalidType'),
      })
      return
    }
    const url = URL.createObjectURL(file)
    setCropSrc(url)
  }

  const handleCropConfirm = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const result = await uploadAvatarAction(formData)
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: tCommon('error'),
          description: result.error || t('avatarUploadFailed'),
        })
        return
      }
      if (cropSrc) URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
      toast({ title: t('avatarUploaded') })
      onChanged()
    } catch {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: t('avatarUploadFailed'),
      })
    } finally {
      setIsUploading(false)
    }
  }

  const busy = isUploading || removeAction.isPending

  return (
    <div className="space-y-2">
      <Label>{t('avatar')}</Label>
      <div className="flex items-center gap-4">
        <UserAvatar name={name} image={image} updatedAt={updatedAt} className="h-20 w-20" />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {image ? t('avatarChange') : t('avatarUpload')}
          </Button>
          {image && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t('avatarRemove')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('avatarHint')}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handlePick(file)
          e.target.value = ''
        }}
      />
      <AvatarCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        isSaving={isUploading}
        title={t('avatarCropTitle')}
        description={t('avatarCropDescription')}
        confirmLabel={t('avatarCropConfirm')}
        cancelLabel={tCommon('cancel')}
        zoomLabel={t('avatarZoom')}
        onOpenChange={(open) => {
          if (!open && cropSrc) URL.revokeObjectURL(cropSrc)
          if (!open) setCropSrc(null)
        }}
        onConfirm={handleCropConfirm}
      />
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={(open) => !open && setRemoveOpen(false)}
        title={t('avatarRemoveConfirm.title')}
        description={t('avatarRemoveConfirm.description')}
        confirmLabel={t('avatarRemove')}
        cancelLabel={tCommon('cancel')}
        onConfirm={() => removeAction.execute({})}
        isPending={removeAction.isPending}
      />
    </div>
  )
}
