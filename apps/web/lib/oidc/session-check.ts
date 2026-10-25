import { getCurrentUserWithGroups } from '@habidat/auth/session'
import { interactionPolicy } from 'oidc-provider'
import { canUseOidcClient } from './app-access'
import { oidcSessionIsStale } from './policy'

/**
 * The default policy plus a login check that sends a request to the
 * interaction when oidc-provider's own session no longer matches the habidat
 * SSO session (see oidcSessionIsStale). With prompt=none the client gets
 * login_required instead.
 */
export function oidcInteractionPolicy(): interactionPolicy.DefaultPolicy {
  const policy = interactionPolicy.base()
  policy.get('login')?.checks.add(
    new interactionPolicy.Check(
      'sso_session',
      'The habidat SSO session ended, changed user, or no longer allows this app',
      async (ctx) => {
        const oidcAccountId = ctx.oidc.session?.accountId
        const resumedFromInteraction = !!ctx.oidc.result?.login
        // Nothing to compare: no_session or the interaction already decided.
        if (!oidcAccountId || resumedFromInteraction)
          return interactionPolicy.Check.NO_NEED_TO_PROMPT
        const sso = await getCurrentUserWithGroups()
        return oidcSessionIsStale({
          oidcAccountId,
          resumedFromInteraction,
          ssoUserId: sso?.user.id ?? null,
          canUseApp: async () => !!sso && canUseOidcClient(sso, ctx.oidc.client?.clientId ?? ''),
        })
      }
    )
  )
  return policy
}
