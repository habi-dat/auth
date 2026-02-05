'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  updateGeneralSettingsAction,
  removeLogoAction,
} from '@/lib/actions/settings-actions'
import { uploadLogoAction } from '@/lib/actions/upload-logo-action'
import type { GeneralSettings } from '@/lib/settings/general'
import { useToast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

interface GeneralSettingsFormProps {
  initialSettings: GeneralSettings
}

export function GeneralSettingsForm({ initialSettings }: GeneralSettingsFormProps) {
  const t = useTranslations('settings.general')
  const { toast } = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [platformName, setPlatformName] = useState(initialSettings.platformName ?? '')
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl ?? '')
  const [logoVersion, setLogoVersion] = useState(0)
  const [supportEmail, setSupportEmail] = useState(initialSettings.supportEmail ?? '')
  const [loginPageText, setLoginPageText] = useState(initialSettings.loginPageText ?? '')
  const [defaultTheme, setDefaultTheme] = useState(
    initialSettings.defaultTheme && ['1', '2', '3', '4'].includes(initialSettings.defaultTheme)
      ? initialSettings.defaultTheme
      : '1'
  )
  const [isPending, setIsPending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    const result = await updateGeneralSettingsAction({
      platformName: platformName.trim() || undefined,
      supportEmail: supportEmail.trim() || undefined,
      loginPageText: loginPageText.trim() || undefined,
      defaultTheme: defaultTheme as '1' | '2' | '3' | '4',
    })
    setIsPending(false)
    if (result?.data?.success) {
      toast({ title: t('saved') })
    }
    if (result?.serverError) {
      toast({ title: t('save'), description: result.serverError, variant: 'destructive' })
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const formData = new FormData()
    formData.set('logo', file)
    const result = await uploadLogoAction(formData)
    setIsUploading(false)
    e.target.value = ''
    if (result.success) {
      setLogoUrl(result.logoUrl)
      setLogoVersion((v) => v + 1)
      router.refresh()
      toast({ title: t('logoUploaded') })
    } else {
      toast({ title: t('logoUploadFailed'), description: result.error, variant: 'destructive' })
    }
  }

  const handleRemoveLogo = async () => {
    setIsPending(true)
    const result = await removeLogoAction({})
    setIsPending(false)
    if (result?.data?.success) {
      setLogoUrl('')
      router.refresh()
      toast({ title: t('logoRemoved') })
    }
    if (result?.serverError) {
      toast({ title: t('save'), description: result.serverError, variant: 'destructive' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="platformName">{t('platformName')}</Label>
        <Input
          id="platformName"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          placeholder={t('platformNamePlaceholder')}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('logo')}</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleLogoChange}
          disabled={isUploading}
          className="sr-only"
          aria-label={logoUrl ? t('logoReplace') : t('logoUpload')}
        />
        <div className="flex flex-wrap items-start gap-6">
          {logoUrl ? (
            <div className="flex flex-col items-start gap-2">
              <div className="border-border flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoVersion ? `${logoUrl}?v=${logoVersion}` : logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  width={80}
                  height={80}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? '…' : t('logoReplace')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={isPending}
                >
                  {t('logoRemove')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? '…' : t('logoUpload')}
              </Button>
              <p className="text-muted-foreground text-xs">{t('logoUploadHelp')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supportEmail">{t('supportEmail')}</Label>
        <Input
          id="supportEmail"
          type="email"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          placeholder={t('supportEmailPlaceholder')}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loginPageText">{t('loginPageText')}</Label>
        <Textarea
          id="loginPageText"
          value={loginPageText}
          onChange={(e) => setLoginPageText(e.target.value)}
          placeholder={t('loginPageTextPlaceholder')}
          rows={3}
          maxLength={1000}
          className="resize-y"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultTheme">{t('defaultTheme')}</Label>
        <Select value={defaultTheme} onValueChange={(v) => setDefaultTheme(v)}>
          <SelectTrigger id="defaultTheme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t('theme1')}</SelectItem>
            <SelectItem value="2">{t('theme2')}</SelectItem>
            <SelectItem value="3">{t('theme3')}</SelectItem>
            <SelectItem value="4">{t('theme4')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? '…' : t('save')}
      </Button>
    </form>
  )
}
