import { requireUserWithGroups } from '@/lib/auth/session'
import { EditProfileForm } from './edit-profile-form'

export default async function EditProfilePage() {
  const { user } = await requireUserWithGroups()
  return <EditProfileForm initialUser={user} />
}
