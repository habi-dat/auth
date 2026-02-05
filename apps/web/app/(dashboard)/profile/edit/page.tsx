import { requireUserWithGroups } from '@/lib/auth/session'
import { EditProfileForm } from './edit-profile-form'

export default async function EditProfilePage() {
  const { user, memberships } = await requireUserWithGroups()
  const memberGroups = memberships.map((m) => m.group)
  return <EditProfileForm initialUser={user} memberGroups={memberGroups} />
}
