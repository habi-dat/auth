# Two lifetimes for an SSO session

A password-only community login uses an idle timeout and an absolute lifetime. An ordinary SSO session ends after 12 hours unused or 24 hours after login, whichever comes first. Choosing to stay logged in starts a persistent SSO session that ends 30 days after that login and is not extended by use. The choice is remembered on that browser and starts unchecked, because a shared computer should not inherit a long login. App sessions are unchanged.

## Considered options

- One sliding lifetime: daily use never asks for the password again, and a night away still feels short.
- Enterprise defaults of a few minutes idle and a working-day cap: too short for a portal people open a few times a day.
- A browser-close flag: that only decides whether the cookie dies with the browser, and it cannot express two lifetimes.
