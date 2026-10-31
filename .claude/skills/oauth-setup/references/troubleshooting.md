# OAuth Troubleshooting

## `redirect_uri_mismatch`
Google rejects the callback because the `callbackURL` your app sent doesn't exactly match one of the "Authorized redirect URIs" configured in Google Cloud Console — including scheme (`http` vs `https`), trailing slash, and port. Fix: make the console entry match exactly what the app sends, for every environment (local dev AND production need their own registered URI).

## Session not persisting after login (user appears logged out immediately)
Usual causes, in order of likelihood:
1. `secure: true` cookie flag set while testing over plain `http` (e.g. local dev without HTTPS) — the browser silently refuses to store the cookie. Use `secure: process.env.NODE_ENV === 'production'`, not `true` unconditionally.
2. Session store misconfigured (e.g. `connect-pg-simple` pointed at the wrong table/pool) — check server logs for session-store connection errors.
3. `sameSite: 'strict'` instead of `'lax'` — can block the cookie from being sent on the redirect back from Google in some browsers. Use `'lax'`.

## "This app isn't verified" warning on the consent screen
Expected for a small/personal OAuth app in "Testing" publish status — only matters for apps requesting sensitive scopes or needing to scale beyond ~100 test users. For `email`/`profile` scopes only, you can move the app to "In production" publish status without needing Google's verification review.

## Login works but `req.user` is undefined on subsequent requests
Check that `passport.session()` middleware is registered after `express-session` and before your routes:
```ts
app.use(session({ ... }));
app.use(passport.initialize());
app.use(passport.session());
// routes after this point
```
Missing `passport.session()` means `deserializeUser` never runs, so `req.user` stays empty even though the session cookie is valid.

## Testing the OAuth flow locally
You need a real Google redirect, which means `localhost` must be a registered redirect URI (Google allows `http://localhost` for local dev) — you cannot fully mock this flow end-to-end without hitting Google's actual OAuth endpoints at least once per flow change.
