import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as usersRepository from '../modules/users/repository.js';
import type { User } from '../modules/users/repository.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // Absolute, built from FRONTEND_URL — not relative. A relative
      // callbackURL gets resolved against the *incoming request's* Host
      // header, but that request reaches Express via Next's internal
      // rewrite proxy (APPROACH.md §6), so its Host is the container
      // hostname (e.g. api:4000), not a URL Google was ever told about.
      // Google must redirect the browser to the frontend's own origin
      // (which proxies /auth/* back to this server), since the API has no
      // public port at all in production.
      callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleSub = profile.id;
        const email = profile.emails?.[0]?.value ?? '';
        let user = await usersRepository.findByGoogleSub(googleSub);
        if (!user) {
          user = await usersRepository.create({
            googleSub,
            email,
            displayName: profile.displayName,
          });
        }
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await usersRepository.findById(id);
    done(null, user ?? false);
  } catch (err) {
    done(err as Error);
  }
});

export default passport;
