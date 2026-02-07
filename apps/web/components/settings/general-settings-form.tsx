'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormFooter } from '@/components/ui/form-footer'
import { ImageUpload } from '@/components/ui/image-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { removeLogoAction, updateGeneralSettingsAction } from '@/lib/actions/settings-actions'
import { uploadLogoAction } from '@/lib/actions/upload-logo-action'
import type { GeneralSettings } from '@/lib/settings/general'

interface GeneralSettingsFormProps {
  initialSettings: GeneralSettings
}

export function GeneralSettingsForm({ initialSettings }: GeneralSettingsFormProps) {
  const t = useTranslations('settings.general')
  const { toast } = useToast()
  const router = useRouter()
  const [platformName, setPlatformName] = useState(initialSettings.platformName ?? '')
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl ?? '')
  const [logoVersion, setLogoVersion] = useState(0)
  const [supportEmail, setSupportEmail] = useState(initialSettings.supportEmail ?? '')
  const [loginPageText, setLoginPageText] = useState(initialSettings.loginPageText ?? '')
  const [themeColor, setThemeColor] = useState(initialSettings.themeColor ?? '#0088cc')
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    const result = await updateGeneralSettingsAction({
      platformName: platformName.trim() || undefined,
      supportEmail: supportEmail.trim() || undefined,
      loginPageText: loginPageText.trim() || undefined,
      themeColor,
    })
    setIsPending(false)
    if (result?.data?.success) {
      toast({ title: t('saved') })
      router.refresh()
    }
    if (result?.serverError) {
      toast({ title: t('save'), description: result.serverError, variant: 'destructive' })
    }
  }

  const handleLogoUpload = async (file: File) => {
    const formData = new FormData()
    formData.set('logo', file)
    const result = await uploadLogoAction(formData)
    if (result.success) {
      setLogoUrl(result.logoUrl)
      setLogoVersion((v) => v + 1)
      router.refresh()
      toast({ title: t('logoUploaded') })
      return result.logoUrl
    }
    throw new Error(result.error)
  }

  const handleLogoRemove = async () => {
    const result = await removeLogoAction()
    if (result?.data?.success) {
      setLogoUrl('')
      router.refresh()
      toast({ title: t('logoRemoved') })
      return
    }
    if (result?.serverError) {
      throw new Error(result.serverError)
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

      <ImageUpload
        label={t('logo')}
        value={logoUrl || null}
        onUpload={handleLogoUpload}
        onRemove={handleLogoRemove}
        hint={t('logoUploadHelp')}
        size="md"
        cacheKey={logoVersion}
      />

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
        <Label htmlFor="themeColor">{t('themeColor')}</Label>
        <div className="flex gap-4 items-center">
          <div className="relative">
            <Input
              id="themeColor"
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-10 w-20 p-1 cursor-pointer"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setThemeColor('#0088cc')}
            disabled={themeColor === '#0088cc'}
          >
            {t('resetColor')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('themeColorHelp')}</p>
      </div>
      <FormFooter isLoading={isPending} submitLabel={t('save')} className="flex justify-end" />
    </form>
  )
}
