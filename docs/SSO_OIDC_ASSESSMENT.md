# SSO / OIDC Feasibility Assessment — Phase 2

## Current Authentication

- **Strategy**: `passport-local` with scrypt password hashing (64-byte key, 16-byte salt)
- **Sessions**: `express-session` with `connect-pg-simple` (PostgreSQL session store)
- **Password comparison**: `crypto.timingSafeEqual` (timing-attack safe)
- **Roles**: Enforced via `requireRole()` middleware (`admin`, `coordinator`, `supervisor`, `washer`, `customer`)
- **Session cookie**: `HttpOnly`, `SameSite=lax`, `Secure` in production

## OIDC Integration Path

### Recommended: `passport-openidconnect` strategy
- Drop-in alongside existing `passport-local` — supports **dual auth** (local + OIDC)
- Minimal disruption to existing session handling
- Session store (`connect-pg-simple`) works unchanged

### Required Changes

1. **Add `passport-openidconnect` package** (~5KB, well-maintained)
2. **Environment variables**:
   - `OIDC_ISSUER_URL` — e.g. `https://login.microsoftonline.com/{tenant}/v2.0`
   - `OIDC_CLIENT_ID`
   - `OIDC_CLIENT_SECRET`
   - `OIDC_REDIRECT_URI` — e.g. `https://app.example.com/auth/oidc/callback`
3. **New routes** (3 total):
   - `GET /auth/oidc` — initiates OIDC login flow
   - `GET /auth/oidc/callback` — handles provider callback, creates/links user
   - `POST /auth/oidc/logout` — destroys session + optional RP-initiated logout
4. **User linking**: On OIDC callback, match by email to existing user or create new one with default role
5. **Schema change**: Add optional `oidcSubject` column to `users` table for subject ID binding

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Session store compatibility | Low | `connect-pg-simple` works unchanged |
| Existing local auth breakage | Low | Dual strategy — local login unaffected |
| Role mapping from OIDC claims | Medium | Map OIDC groups/roles claim to app roles, fallback to `washer` |
| Token refresh | Low | Session-based — no client tokens to refresh |
| Multi-tenant support | Medium | Validate issuer against allowlist |

### NOT Recommended for Phase 2

- **Full JWT-based auth replacement** — Would require rewriting all `requireAuth` middleware, session handling, and client auth flow. High risk, high effort.
- **SAML** — More complex than OIDC, less relevant for modern deployments.
- **Custom OAuth2** — Unnecessary when OIDC covers the use case.

## Verdict

**OIDC is non-destabilizing and implementable in Phase 3.** The dual-strategy approach preserves all existing auth behavior while adding federated login. Estimated scope: ~150 lines of server code, 1 schema migration, 1 new UI button.

## Implementation Sketch (for Phase 3)

```typescript
// server/auth.ts — add alongside existing LocalStrategy
import { Strategy as OidcStrategy } from 'passport-openidconnect';

passport.use('oidc', new OidcStrategy({
  issuer: process.env.OIDC_ISSUER_URL,
  clientID: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  callbackURL: process.env.OIDC_REDIRECT_URI,
  scope: ['openid', 'profile', 'email'],
}, async (issuer, profile, done) => {
  // Find or create user by OIDC subject
  let user = await storage.getUserByOidcSubject(profile.id);
  if (!user) {
    const email = profile.emails?.[0]?.value;
    user = await storage.getUserByEmail(email);
    if (user) {
      await storage.updateUser(user.id, { oidcSubject: profile.id });
    } else {
      user = await storage.createUser({
        username: email || profile.displayName,
        displayName: profile.displayName,
        password: '', // No password for OIDC-only users
        role: 'washer', // Default role
        oidcSubject: profile.id,
      });
    }
  }
  done(null, user);
}));
```
