# habidat-auth Rewrite Audit Findings

This document summarizes the findings of a thorough audit regarding feature completeness and potential security issues of the `habidat-auth` application rewrite, based on the `rewrite.md` specification.

## 1. Executive Summary

The rewrite is substantially complete and follows the modern monorepo architecture described in `rewrite.md`. The core transition to PostgreSQL as the single source of truth, with BullMQ-driven synchronization to LDAP and Discourse, is well-implemented and robust. However, several security concerns and feature gaps were identified, particularly in the SAML and OIDC implementations.

---

## 2. Feature Completeness Audit

| Feature | Status | Notes |
|---------|--------|-------|
| **Data Model (Prisma)** | ✅ Complete | Follows the spec perfectly. Includes sync markers and hierarchical groups. |
| **Monorepo Structure** | ⚠️ Partial | `apps/web` and `apps/worker` are well-structured. However, `packages/auth` and `packages/saml` are empty; logic is partially duplicated or resides in `apps/web/lib`. |
| **Authentication** | ✅ Complete | `better-auth` is integrated and handles both scrypt (new) and SSHA (legacy) hashes. |
| **Authorization** | ✅ Complete | Role-based access control (Admin, Group Admin, Member) is correctly derived from group memberships. |
| **Synchronization** | ✅ Complete | LDAP and Discourse sync via BullMQ is implemented with retry logic and outbox pattern. |
| **SAML IdP** | ⚠️ Partial | Core SSO flow works, but Single Logout (SLO) is only partially implemented (only logs out the first SP). |
| **OIDC Provider** | ✅ Complete | Implemented using `oidc-provider` and integrated with Prisma clients. |
| **Management UI** | 🟢 Substantial | User, Group, App, and Invitation management actions are robust and audited. |
| **Internationalization** | ⚠️ Partial | Infrastructure exists, but `en.json` appears to be significantly incomplete compared to `de.json`. |

---

## 3. Security Audit

### 3.1 [CRITICAL] SAML XML Schema Validation Skipped
In [apps/web/lib/saml/config.ts](file:///home/florian/sources/habidat-auth/apps/web/lib/saml/config.ts#L17-L19), XML schema validation is explicitly disabled:
```typescript
setSchemaValidator({
  validate: () => Promise.resolve('skipped'),
})
```
> [!CAUTION]
> This exposes the Identity Provider to XML-based attacks such as XXE (XML External Entity) and SAML Signature Wrapping. Schema validation is a critical layer of defense for SAML.

### 3.2 [MEDIUM] Incomplete SAML Single Logout (SLO)
The current SLO implementation in [apps/web/app/sso/logout/[appSlug]/route.ts](file:///home/florian/sources/habidat-auth/apps/web/app/sso/logout/[appSlug]/route.ts) only initiates logout for the **first** service provider (SP) found in the session:
```typescript
const first = samlApps[0]
// ... redirects to first SP for SLO ...
```
> [!WARNING]
> If a user is logged into multiple SAML-enabled applications, only the first one will be notified of the logout. The user's sessions in other applications will remain active.

### 3.3 [MEDIUM] Permissive Trusted Origins
In [apps/web/lib/auth.ts](file:///home/florian/sources/habidat-auth/apps/web/lib/auth.ts#L30), the authentication system dynamically adds the `Origin` header to `trustedOrigins`:
```typescript
const origin = request?.headers?.get?.('origin')
if (origin) origins.push(origin)
```
> [!IMPORTANT]
> While `better-auth` has internal CSRF protections, explicitly trusting any origin provided in the request headers can weaken these protections in certain proxy configurations.

### 3.4 [LOW] Insecure Default for OIDC Cookie Keys
In [apps/web/lib/oidc/config.ts](file:///home/florian/sources/habidat-auth/apps/web/lib/oidc/config.ts#L99), the `OIDC_COOKIE_KEYS` defaults to a hardcoded string:
```typescript
cookies: {
  keys: process.env.OIDC_COOKIE_KEYS
    ? (process.env.OIDC_COOKIE_KEYS as string).split(',').map((s) => s.trim())
    : ['oidc-session-key-change-me'],
},
```
> [!NOTE]
> It is highly recommended to throw an error during startup if mandatory security keys are missing in production.

---

## 4. Recommendations

1.  **Enable SAML Schema Validation**: Implement proper XML schema validation in `samlify`. If the built-in validator is difficult to configure, use a reliable external library.
2.  **Implement SLO Chaining**: Update the SAML logout flow to chain through all active SP sessions or use an iframe-based multi-logout approach.
3.  **Tighten Trusted Origins**: Restrict `trustedOrigins` to a known list of domains or a strict wildcard pattern (e.g., `*.habidat.local`).
4.  **Consolidate Packages**: Move SAML and Auth logic from `apps/web/lib` to their respective shared packages in `packages/` as originally specified.
5.  **Complete English Translations**: Synchronize `en.json` with `de.json` to ensure English-speaking users have a consistent experience.
