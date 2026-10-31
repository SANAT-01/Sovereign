# Google OAuth Flow — step by step

## 1. Google Cloud Console setup (one-time, manual)
1. Create a project (or reuse one) in Google Cloud Console.
2. Configure the OAuth consent screen: app name, support email. Scopes needed: `email`, `profile` only — these are non-sensitive, so no Google app-verification review is required for basic sign-in.
3. Create an OAuth Client ID (type: "Web application").
4. Add authorized redirect URI: `https://sanattudu.tech/auth/google/callback` (and a `localhost` equivalent for local dev, e.g. `http://localhost:3000/auth/google/callback`).
5. Store the generated `client_id` and `client_secret` as environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) — never commit them.

## 2. Passport strategy (`/apps/api/src/auth/google.ts`)
```ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as usersRepository from '../modules/users/repository'; // or wherever the shared users table lives

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleSub = profile.id;
      const email = profile.emails?.[0]?.value;
      let user = await usersRepository.findByGoogleSub(googleSub);
      if (!user) {
        user = await usersRepository.create({ googleSub, email, displayName: profile.displayName });
      }
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  },
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  const user = await usersRepository.findById(id);
  done(null, user);
});
```

## 3. Routes
```ts
app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    res.redirect('/'); // successful login — session cookie is now set
  },
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});
```

## 4. Linking to the shared `users` table
`findByGoogleSub` / `create` above are the only two operations auth needs against `users` — keep this as a minimal repository, not a full module, since `users` isn't a feature module in its own right, it's the shared identity root every other module's tables reference (`data-modeling` skill, schema-conventions.md).

## 5. Frontend side
Next.js just links to `/auth/google` (a full page navigation, not a fetch — OAuth redirects require a real browser navigation) and reads session state via a `/auth/me` endpoint or similar to know if the user is logged in.
