import { Button } from '@/components/ui/button'
import { UserForm } from '@/components/users/user-form'
import { getGroupsForSelect } from '@/lib/actions/group-actions'
import { getUser } from '@/lib/actions/user-actions'
import { canManageUser } from '@/lib/auth/roles'
import { requireGroupAdmin } from '@/lib/auth/session'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: PageProps) {
  const { id } = await params
  const session = await requireGroupAdmin()
  const [user, groups] = await Promise.all([getUser(id), getGroupsForSelect()])

  if (!user) {
    notFound()
  }

  // Check if current user can manage this user
  if (!canManageUser(session, user.memberships)) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">@{user.username}</p>
        </div>
      </div>

      <UserForm user={user} groups={groups} />
    </div>
  )
}
