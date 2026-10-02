# Habidat

Habidat is the login a person uses to reach the apps of a housing project.

## Language

**SSO session**:
The habidat login that lets a person open connected apps without typing the password again. A connected app can still demand the password for a single visit.
_Avoid_: session TTL, remember me

**Ordinary SSO session**:
An SSO session from a login where the person did not choose to stay logged in. It ends after a stretch without use, and also at a fixed time after that login, whichever comes first.
_Avoid_: short session, default session

**Persistent SSO session**:
An SSO session from a login where the person chose to stay logged in. It lasts a fixed length from that login.
_Avoid_: remember me, long session

**Idle timeout**:
How long an SSO session may go unused before it ends.
_Avoid_: TTL, sliding expiration

**Absolute lifetime**:
The longest an SSO session may last after login, even when it keeps being used.
_Avoid_: max TTL, hard timeout

**App session**:
A login inside one connected app, such as the cloud, the forum, or the wiki. It is separate from the SSO session.
_Avoid_: SSO session
