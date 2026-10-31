import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as usersRepository from '../modules/users/repository';
import type { User } from '../modules/users/repository';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: '/auth/google/callback',
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
