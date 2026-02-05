'use client'

import { GroupSelector } from '@/components/groups/group-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { createAppAction, updateAppAction } from '@/lib/actions/app-actions'
import type { getApps } from '@/lib/actions/app-actions'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

type AppRow = Awaited<ReturnType<typeof getApps>>[number]

const appFormSchema = z.object({
  slug: z.string().min(2).regex(/^[a-zA-Z0-9-]+$/),
  name: z.string().min(2),
  url: z.string().url(),
  iconUrl: z.string().url().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0),
  samlEnabled: z.boolean(),
  samlEntityId: z.string().optional().nullable(),
  samlAcsUrl: z.string().url().optional().nullable(),
  samlSloUrl: z.string().url().optional().nullable(),
  samlCertificate: z.string().optional().nullable(),
  oidcEnabled: z.boolean(),
  oidcClientId: z.string().optional().nullable(),
  oidcRedirectUris: z.string().optional().nullable(),
  oidcClientSecret: z.string().optional().nullable(),
  groupIds: z.array(z.string()).optional(),
})

type AppFormValues = z.infer<typeof appFormSchema>

interface AppFormProps {
  app?: AppRow
  allGroups: Array<{ id: string; name: string; slug: string }>
}

export function AppForm({ app, allGroups }: AppFormProps) {
  const t = useTranslations('apps')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { toast } = useToast()
  const isEditing = !!app

  const createAction = useAction(createAppAction, {
    onSuccess: () => {
      toast({ title: t('created') })
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

  const updateAction = useAction(updateAppAction, {
    onSuccess: () => {
      toast({ title: t('updated') })
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
    resolver: zodResolver(appFormSchema),
    defaultValues: {
      slug: app?.slug ?? '',
      name: app?.name ?? '',
      url: app?.url ?? '',
      iconUrl: app?.iconUrl ?? null,
      sortOrder: app?.sortOrder ?? 0,
      samlEnabled: app?.samlEnabled ?? false,
      samlEntityId: app?.samlEntityId ?? null,
      samlAcsUrl: app?.samlAcsUrl ?? null,
      samlSloUrl: app?.samlSloUrl ?? null,
      samlCertificate: app?.samlCertificate ?? null,
      oidcEnabled: app?.oidcEnabled ?? false,
      oidcClientId: app?.oidcClientId ?? null,
      oidcRedirectUris: app?.oidcRedirectUris ?? null,
      oidcClientSecret: app?.oidcClientSecret ?? null,
      groupIds: app?.groupAccess.map((a) => a.groupId) ?? [],
    },
  })

  const samlEnabled = form.watch('samlEnabled')
  const oidcEnabled = form.watch('oidcEnabled')

  const onSubmit = (data: AppFormValues) => {
    const payload = {
      slug: data.slug,
      name: data.name,
      url: data.url,
      iconUrl: data.iconUrl ?? null,
      sortOrder: data.sortOrder,
      samlEnabled: data.samlEnabled,
      samlEntityId: data.samlEnabled ? data.samlEntityId ?? null : null,
      samlAcsUrl: data.samlEnabled ? data.samlAcsUrl ?? null : null,
      samlSloUrl: data.samlEnabled ? data.samlSloUrl ?? null : null,
      samlCertificate: data.samlEnabled ? data.samlCertificate ?? null : null,
      oidcEnabled: data.oidcEnabled,
      oidcClientId: data.oidcEnabled ? data.oidcClientId ?? null : null,
      oidcRedirectUris: data.oidcEnabled ? data.oidcRedirectUris ?? null : null,
      oidcClientSecret: data.oidcEnabled ? data.oidcClientSecret ?? null : null,
      groupIds: data.groupIds ?? [],
    }
    if (isEditing && app) {
      updateAction.execute({ ...payload, id: app.id })
    } else {
      createAction.execute(payload)
    }
  }

  const isExecuting = createAction.status === 'executing' || updateAction.status === 'executing'

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
                {...form.register('name')}
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
                {...form.register('slug')}
                disabled={isEditing || isExecuting}
                placeholder={t('slugPlaceholder')}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iconUrl">{t('iconUrl')}</Label>
              <Input
                id="iconUrl"
                type="url"
                {...form.register('iconUrl')}
                disabled={isExecuting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t('sortOrder')}</Label>
              <Input
                id="sortOrder"
                type="number"
                {...form.register('sortOrder')}
                disabled={isExecuting}
                min={0}
              />
            </div>
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
            <input
              type="checkbox"
              id="samlEnabled"
              {...form.register('samlEnabled')}
              disabled={isExecuting}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="samlEnabled">{t('samlEnabled')}</Label>
          </div>
          {samlEnabled && (
            <>
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
            </>
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
            <input
              type="checkbox"
              id="oidcEnabled"
              {...form.register('oidcEnabled')}
              disabled={isExecuting}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="oidcEnabled">{t('oidcEnabled')}</Label>
          </div>
          {oidcEnabled && (
            <div className="space-y-4">
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

      <div className="flex gap-4">
        <Link href="/apps">
          <Button type="button" variant="outline" disabled={isExecuting}>
            {tCommon('cancel')}
          </Button>
        </Link>
        <Button type="submit" disabled={isExecuting}>
          {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </Button>
      </div>
    </form>
  )
}
