'use server'

import { adminAction } from '@/lib/actions/client'
import { createAuditLog } from '@/lib/audit'
import { prisma } from '@habidat/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function getApps() {
  return prisma.app.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      groupAccess: { include: { group: { select: { id: true, name: true, slug: true } } } },
    },
  })
}

/** Get apps accessible to a user based on their group memberships */
export async function getUserApps(userGroupIds: string[]) {
  return prisma.app.findMany({
    where: {
      OR: [
        // Apps with no group restrictions (open to all)
        { groupAccess: { none: {} } },
        // Apps where user is in one of the allowed groups
        { groupAccess: { some: { groupId: { in: userGroupIds } } } },
      ],
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      url: true,
      iconUrl: true,
      logoUrl: true,
      useIconAsLogo: true,
    },
  })
}

const appSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-zA-Z0-9-]+$/, 'Slug must be letters, numbers, hyphens only'),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  url: z.string().url(),
  iconUrl: z.string().url().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  useIconAsLogo: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  samlEnabled: z.boolean().default(false),
  samlEntityId: z.string().optional().nullable(),
  samlAcsUrl: z.string().url().optional().nullable(),
  samlSloUrl: z.string().url().optional().nullable(),
  samlCertificate: z.string().optional().nullable(),
  oidcEnabled: z.boolean().default(false),
  oidcClientId: z.string().optional().nullable(),
  oidcRedirectUris: z.string().optional().nullable(),
  oidcClientSecret: z.string().optional().nullable(),
  groupIds: z.array(z.string().cuid()).optional(),
})

export const createAppAction = adminAction
  .schema(appSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await prisma.app.findUnique({
      where: { slug: parsedInput.slug },
    })
    if (existing) {
      throw new Error('An app with this slug already exists')
    }

    const app = await prisma.app.create({
      data: {
        slug: parsedInput.slug,
        name: parsedInput.name,
        description: parsedInput.description ?? undefined,
        url: parsedInput.url,
        iconUrl: parsedInput.iconUrl ?? undefined,
        logoUrl: parsedInput.logoUrl ?? undefined,
        useIconAsLogo: parsedInput.useIconAsLogo,
        sortOrder: parsedInput.sortOrder,
        samlEnabled: parsedInput.samlEnabled,
        samlEntityId: parsedInput.samlEntityId ?? undefined,
        samlAcsUrl: parsedInput.samlAcsUrl ?? undefined,
        samlSloUrl: parsedInput.samlSloUrl ?? undefined,
        samlCertificate: parsedInput.samlCertificate ?? undefined,
        oidcEnabled: parsedInput.oidcEnabled,
        oidcClientId: parsedInput.oidcClientId ?? undefined,
        groupAccess: {
          create: (parsedInput.groupIds ?? []).map((groupId) => ({ groupId })),
        },
      },
      include: { groupAccess: true },
    })

    await createAuditLog({
      actorId: ctx.session.user.id,
      action: 'CREATE',
      entityType: 'APP',
      entityId: app.id,
      newValue: app,
    })

    revalidatePath('/apps')
    return { app }
  })

export const updateAppAction = adminAction
  .schema(appSchema.extend({ id: z.string().cuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const oldApp = await prisma.app.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: { groupAccess: true },
    })

    const app = await prisma.$transaction(async (tx) => {
      const updated = await tx.app.update({
        where: { id: parsedInput.id },
        data: {
          slug: parsedInput.slug,
          name: parsedInput.name,
          description: parsedInput.description ?? undefined,
          url: parsedInput.url,
          iconUrl: parsedInput.iconUrl ?? undefined,
          logoUrl: parsedInput.logoUrl ?? undefined,
          useIconAsLogo: parsedInput.useIconAsLogo,
          sortOrder: parsedInput.sortOrder,
          samlEnabled: parsedInput.samlEnabled,
          samlEntityId: parsedInput.samlEntityId ?? undefined,
          samlAcsUrl: parsedInput.samlAcsUrl ?? undefined,
          samlSloUrl: parsedInput.samlSloUrl ?? undefined,
          samlCertificate: parsedInput.samlCertificate ?? undefined,
          oidcEnabled: parsedInput.oidcEnabled,
          oidcClientId: parsedInput.oidcClientId ?? undefined,
          oidcRedirectUris: parsedInput.oidcRedirectUris ?? undefined,
          oidcClientSecret: parsedInput.oidcClientSecret ?? undefined,
        },
      })
      await tx.appGroupAccess.deleteMany({
        where: { appId: parsedInput.id },
      })
      if ((parsedInput.groupIds ?? []).length > 0) {
        await tx.appGroupAccess.createMany({
          data: parsedInput.groupIds!.map((groupId) => ({
            appId: parsedInput.id,
            groupId,
          })),
        })
      }
      return updated
    })

    await createAuditLog({
      actorId: ctx.session.user.id,
      action: 'UPDATE',
      entityType: 'APP',
      entityId: app.id,
      oldValue: oldApp,
      newValue: app,
    })

    revalidatePath('/apps')
    revalidatePath(`/apps/${oldApp.slug}/edit`)
    revalidatePath(`/apps/${app.slug}/edit`)
    return { app }
  })

export const deleteAppAction = adminAction
  .schema(z.object({ id: z.string().cuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const app = await prisma.app.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: { groupAccess: true },
    })

    await prisma.app.delete({
      where: { id: parsedInput.id },
    })

    await createAuditLog({
      actorId: ctx.session.user.id,
      action: 'DELETE',
      entityType: 'APP',
      entityId: app.id,
      oldValue: app,
    })

    revalidatePath('/apps')
    return { success: true }
  })
