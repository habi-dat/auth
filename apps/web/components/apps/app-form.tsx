'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { GroupSelector } from '@/components/groups/group-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormFooter } from '@/components/ui/form-footer'
import { ImageUpload } from '@/components/ui/image-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import type { getApps } from '@/lib/actions/app-actions'
import { createAppAction, deleteAppAction, updateAppAction } from '@/lib/actions/app-actions'
import { removeAppImageAction, uploadAppImageAction } from '@/lib/actions/upload-app-image-action'
import { slugify } from '@/lib/utils'

type AppRow = Awaited<ReturnType<typeof getApps>>[number]

const appFormSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-zA-Z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().default(''),
  url: z.url(),
  sortOrder: z.coerce.number().int().min(0),
  useIconAsLogo: z.boolean(),
  samlEnabled: z.boolean(),
  samlEntityId: z.string().default(''),
  samlAcsUrl: z.string().default(''),
  samlSloUrl: z.string().default(''),
  samlCertificate: z.string().default(''),
  oidcEnabled: z.boolean(),
  oidcClientId: z.string().default(''),
  oidcRedirectUris: z.string().default(''),
  oidcClientSecret: z.string().default(''),
  groupIds: z.array(z.string()).default([]),
  isMain: z.boolean().default(true),
})

type AppFormValues = z.output<typeof appFormSchema>

interface AppFormProps {
  app?: AppRow
  allGroups: Array<{ id: string; name: string; slug: string }>
}

export function AppForm({ app, allGroups }: AppFormProps) {
  const t = useTranslations('apps')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Local state for deferred uploads (creation mode)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [iconUrl, setIconUrl] = useState(app?.iconUrl ?? null)
  const [logoUrl, setLogoUrl] = useState(app?.logoUrl ?? null)
  const [iconVersion, setIconVersion] = useState(0)
  const [logoVersion, setLogoVersion] = useState(0)
  const isEditing = !!app
  const slugManuallyEdited = useRef(isEditing)

  const createAction = useAction(createAppAction, {
    onError: ({ error }) => {
      setIsUploading(false)
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const updateAction = useAction(updateAppAction, {
    onSuccess: () => {
      toast({ title: t('form.updated') })
      router.push('/apps')
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const deleteAction = useAction(deleteAppAction, {
    onSuccess: () => {
      toast({ title: t('deleteConfirm.success') })
      router.push('/apps')
      router.refresh()
    },
    onError: ({ error }) => {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.serverError || tCommon('errorGeneric'),
      })
    },
  })

  const form = useForm<AppFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: too complex to fix
    resolver: zodResolver(appFormSchema) as any,
    defaultValues: {
      slug: app?.slug ?? '',
      name: app?.name ?? '',
      description: app?.description ?? '',
      url: app?.url ?? '',
      sortOrder: app?.sortOrder ?? 0,
      useIconAsLogo: app?.useIconAsLogo ?? false,
      samlEnabled: app?.samlEnabled ?? false,
      samlEntityId: app?.samlEntityId ?? '',
      samlAcsUrl: app?.samlAcsUrl ?? '',
      samlSloUrl: app?.samlSloUrl ?? '',
      samlCertificate: app?.samlCertificate ?? '',
      oidcEnabled: app?.oidcEnabled ?? false,
      oidcClientId: app?.oidcClientId ?? '',
      oidcRedirectUris: app?.oidcRedirectUris ?? '',
      oidcClientSecret: app?.oidcClientSecret ?? '',
      groupIds: app?.groupAccess.map((a) => a.groupId) ?? [],
      isMain: app?.isMain ?? true,
    },
  })

  const samlEnabled = form.watch('samlEnabled')
  const oidcEnabled = form.watch('oidcEnabled')
  const useIconAsLogo = form.watch('useIconAsLogo')

  const handleIconUpload = async (file: File) => {
    if (!isEditing) {
      // Defer upload
      const url = URL.createObjectURL(file)
      setIconUrl(url)
      setIconFile(file)
      return url
    }

    // Direct upload
    if (!app?.id) return
    const formData = new FormData()
    formData.set('appId', app.id)
    formData.set('imageType', 'icon')
    formData.set('file', file)
    const result = await uploadAppImageAction(formData)
    if (result.success) {
      setIconUrl(result.imageUrl)
      setIconVersion((v) => v + 1)
      toast({ title: t('iconUploaded') })
      return result.imageUrl
    }
    throw new Error(result.error)
  }

  const handleIconRemove = async () => {
    if (!isEditing) {
      setIconUrl(null)
      setIconFile(null)
      return
    }

    if (!app?.id) return
    const result = await removeAppImageAction(app.id, 'icon')
    if (result.success) {
      setIconUrl(null)
      toast({ title: t('iconRemoved') })
      return
    }
    throw new Error(result.error)
  }

  const handleLogoUpload = async (file: File) => {
    if (!isEditing) {
      const url = URL.createObjectURL(file)
      setLogoUrl(url)
      setLogoFile(file)
      return url
    }

    if (!app?.id) return
    const formData = new FormData()
    formData.set('appId', app.id)
    formData.set('imageType', 'logo')
    formData.set('file', file)
    const result = await uploadAppImageAction(formData)
    if (result.success) {
      setLogoUrl(result.imageUrl)
      setLogoVersion((v) => v + 1)
      toast({ title: t('logoUploaded') })
      return result.imageUrl
    }
    throw new Error(result.error)
  }

  const handleLogoRemove = async () => {
    if (!isEditing) {
      setLogoUrl(null)
      setLogoFile(null)
      return
    }

    if (!app?.id) return
    const result = await removeAppImageAction(app.id, 'logo')
    if (result.success) {
      setLogoUrl(null)
      toast({ title: t('logoRemoved') })
      return
    }
    throw new Error(result.error)
  }

  const onSubmit = async (data: AppFormValues) => {
    const payload = {
      slug: data.slug,
      name: data.name,
      description: data.description || null,
      url: data.url,
      iconUrl: iconUrl,
      logoUrl: logoUrl,
      useIconAsLogo: data.useIconAsLogo,
      sortOrder: data.sortOrder,
      samlEnabled: data.samlEnabled,
      samlEntityId: data.samlEnabled ? data.samlEntityId || null : null,
      samlAcsUrl: data.samlEnabled ? data.samlAcsUrl || null : null,
      samlSloUrl: data.samlEnabled ? data.samlSloUrl || null : null,
      samlCertificate: data.samlEnabled ? data.samlCertificate || null : null,
      oidcEnabled: data.oidcEnabled,
      oidcClientId: data.oidcEnabled ? data.oidcClientId || null : null,
      oidcRedirectUris: data.oidcEnabled ? data.oidcRedirectUris || null : null,
      oidcClientSecret: data.oidcEnabled ? data.oidcClientSecret || null : null,
      groupIds: data.groupIds || [],
      isMain: data.isMain,
    }

    if (isEditing && app) {
      updateAction.execute({ ...payload, id: app.id })
    } else {
      setIsUploading(true)
      const result = await createAction.executeAsync(payload)

      if (result?.data?.app) {
        const newAppId = result.data.app.id
        const uploadPromises = []

        if (iconFile) {
          const formData = new FormData()
          formData.set('appId', newAppId)
          formData.set('imageType', 'icon')
          formData.set('file', iconFile)
          uploadPromises.push(uploadAppImageAction(formData))
        }

        if (logoFile && !data.useIconAsLogo) {
          const formData = new FormData()
          formData.set('appId', newAppId)
          formData.set('imageType', 'logo')
          formData.set('file', logoFile)
          uploadPromises.push(uploadAppImageAction(formData))
        }

        await Promise.all(uploadPromises)

        toast({ title: t('form.created') })
        router.push('/apps')
        router.refresh()
      } else {
        // Error handling is done in onError callback or checking result.serverError
        setIsUploading(false)
      }
    }
  }

  const isExecuting =
    createAction.status === 'executing' ||
    updateAction.status === 'executing' ||
    deleteAction.status === 'executing' ||
    isUploading

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('name')}</CardTitle>
          <CardDescription>Basis-Informationen der App</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                {...form.register('name', {
                  onChange: (e) => {
                    if (!slugManuallyEdited.current) {
                      form.setValue('slug', slugify(e.target.value))
                    }
                  },
                })}
                disabled={isExecuting}
                placeholder="Meine App"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('slug')}</Label>
              <Input
                id="slug"
                {...form.register('slug', {
                  onChange: () => {
                    slugManuallyEdited.current = true
                  },
                })}
                disabled={isEditing || isExecuting}
                placeholder={t('slugPlaceholder')}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('appDescription')}</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              disabled={isExecuting}
              placeholder={t('appDescriptionPlaceholder')}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">{t('url')}</Label>
            <Input
              id="url"
              type="url"
              {...form.register('url')}
              disabled={isExecuting}
              placeholder={t('urlPlaceholder')}
            />
            {form.formState.errors.url && (
              <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">{t('sortOrder')}</Label>
            <Input
              id="sortOrder"
              type="number"
              {...form.register('sortOrder')}
              disabled={isExecuting}
              min={0}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="isMain"
              checked={form.watch('isMain')}
              onCheckedChange={(checked) => form.setValue('isMain', !!checked)}
              disabled={isExecuting}
            />
            <Label htmlFor="isMain" className="cursor-pointer">
              {t('isMain')}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bilder</CardTitle>
          <CardDescription>
            {isEditing ? t('imagesHint') : 'Bilder für die App hochladen'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <ImageUpload
                label={t('icon')}
                value={iconUrl}
                onUpload={handleIconUpload}
                onRemove={handleIconRemove}
                hint={t('iconHint')}
                size="md"
                cacheKey={iconVersion}
                disabled={isExecuting}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="useIconAsLogo"
                  checked={useIconAsLogo}
                  onCheckedChange={(checked) => form.setValue('useIconAsLogo', !!checked)}
                  disabled={isExecuting}
                />
                <Label htmlFor="useIconAsLogo" className="cursor-pointer">
                  {t('useIconAsLogo')}
                </Label>
              </div>
            </div>

            {!useIconAsLogo && (
              <div className="space-y-4">
                <ImageUpload
                  label={t('logo')}
                  value={logoUrl}
                  onUpload={handleLogoUpload}
                  onRemove={handleLogoRemove}
                  hint={t('logoHint')}
                  size="md"
                  cacheKey={logoVersion}
                  disabled={isExecuting}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('saml')}</CardTitle>
          <CardDescription>SAML 2.0 Identity Provider – SSO für diese App</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="samlEnabled"
              checked={samlEnabled}
              onCheckedChange={(v) => form.setValue('samlEnabled', !!v)}
              disabled={isExecuting}
            />
            <Label htmlFor="samlEnabled">{t('samlEnabled')}</Label>
          </div>
          {samlEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="samlEntityId">{t('samlEntityId')}</Label>
                <Input
                  id="samlEntityId"
                  {...form.register('samlEntityId')}
                  disabled={isExecuting}
                  placeholder="https://app.example.com/saml/metadata"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="samlAcsUrl">{t('samlAcsUrl')}</Label>
                <Input
                  id="samlAcsUrl"
                  type="url"
                  {...form.register('samlAcsUrl')}
                  disabled={isExecuting}
                  placeholder="https://app.example.com/saml/acs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="samlSloUrl">{t('samlSloUrl')}</Label>
                <Input
                  id="samlSloUrl"
                  type="url"
                  {...form.register('samlSloUrl')}
                  disabled={isExecuting}
                  placeholder="https://app.example.com/saml/slo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="samlCertificate">{t('samlCertificate')}</Label>
                <Textarea
                  id="samlCertificate"
                  {...form.register('samlCertificate')}
                  disabled={isExecuting}
                  rows={6}
                  placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('oidc')}</CardTitle>
          <CardDescription>OAuth 2.0 / OpenID Connect – SSO für diese App</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="oidcEnabled"
              checked={oidcEnabled}
              onCheckedChange={(v) => form.setValue('oidcEnabled', !!v)}
              disabled={isExecuting}
            />
            <Label htmlFor="oidcEnabled">{t('oidcEnabled')}</Label>
          </div>
          {oidcEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="oidcClientId">{t('oidcClientId')}</Label>
                <Input
                  id="oidcClientId"
                  {...form.register('oidcClientId')}
                  disabled={isExecuting}
                  placeholder={t('oidcClientIdPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidcRedirectUris">{t('oidcRedirectUris')}</Label>
                <Textarea
                  id="oidcRedirectUris"
                  {...form.register('oidcRedirectUris')}
                  disabled={isExecuting}
                  placeholder={t('oidcRedirectUrisPlaceholder')}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">{t('oidcRedirectUrisHint')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="oidcClientSecret">{t('oidcClientSecret')}</Label>
                <Input
                  id="oidcClientSecret"
                  type="password"
                  autoComplete="off"
                  {...form.register('oidcClientSecret')}
                  disabled={isExecuting}
                  placeholder={t('oidcClientSecretPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">{t('oidcClientSecretHint')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('groupAccess')}</CardTitle>
          <CardDescription>{t('groupAccessHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <GroupSelector
            groups={allGroups}
            value={form.watch('groupIds') ?? []}
            onChange={(ids) => form.setValue('groupIds', ids)}
            placeholder={t('groupAccess')}
            disabled={isExecuting}
          />
        </CardContent>
      </Card>
      <FormFooter
        isLoading={isExecuting}
        isEditing={isEditing}
        cancelHref="/apps"
        onDelete={isEditing ? () => setDeleteDialogOpen(true) : undefined}
        deleteLabel={t('delete')}
      />
      {isEditing && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteConfirm.title')}
          description={app ? t('deleteConfirm.description', { name: app.name }) : ''}
          confirmLabel={t('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => deleteAction.execute({ id: app!.id })}
          isPending={deleteAction.status === 'executing'}
        />
      )}
    </form>
  )
}
