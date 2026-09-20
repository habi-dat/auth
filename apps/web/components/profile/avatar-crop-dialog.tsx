'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getCroppedImageBlob } from '@/lib/avatar/crop-image'

interface AvatarCropDialogProps {
  open: boolean
  imageSrc: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (file: File) => Promise<void>
  isSaving: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  zoomLabel: string
}

export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onConfirm,
  isSaving,
  title,
  description,
  confirmLabel,
  cancelLabel,
  zoomLabel,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    await onConfirm(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative h-80 w-full overflow-hidden rounded-md bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatar-zoom">{zoomLabel}</Label>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer"
            disabled={isSaving}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSaving || !croppedAreaPixels}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
