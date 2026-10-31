# Session Management

## Session store
Don't use the default in-memory session store in production — it leaks memory and loses all sessions on every restart/deploy. Use `connect-pg-simple` to store sessions in the same Postgres instance you already run:

```ts
import session from 'express-session';
import pgSession from 'connect-pg-simple';

app.use(session({
  store: new (pgSession(session))({ pool: pgPool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // requires HTTPS — true in production behind Traefik
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));
```

## Why these cookie flags matter
- `httpOnly: true` — JavaScript can't read the cookie, blocking the most common XSS session-theft vector.
- `secure: true` in production — cookie is only sent over HTTPS, which Traefik already terminates for you (APPROACH.md §6).
- `sameSite: 'lax'` — reasonable default for a same-origin app; blocks most CSRF vectors while still allowing the Google OAuth redirect flow to work (which needs top-level navigation to carry the cookie back).

## SESSION_SECRET
A long random string, stored as an environment variable, never committed. Rotating it invalidates all existing sessions (forces re-login) — fine for a personal app, worth knowing before rotating casually once you have real users.

## Logout
```ts
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});
```
Destroy the session server-side (removes the row from `user_sessions`), not just clear the cookie client-side — otherwise the session technically remains valid if the cookie is replayed.

## Checking auth state from the frontend
Expose a minimal endpoint rather than having the frontend guess from cookie presence:
```ts
app.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName } });
});
```
