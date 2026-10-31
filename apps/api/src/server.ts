import express from 'express';
import session from 'express-session';
import pgSessionFactory from 'connect-pg-simple';
import passport from './auth/google';
import authRoutes from './auth/routes';
import expensesRoutes from './modules/expenses/routes';
import notesRoutes from './modules/notes/routes';
import progressRoutes from './modules/progress/routes';
import portfolioRoutes from './modules/portfolio/routes';
import profileRoutes from './modules/profile/routes';
import { errorHandler } from './middleware/errorHandler';
import { pool } from './db/client';

export function createServer() {
  const app = express();
  const PgSession = pgSessionFactory(session);

  app.use(express.json());

  app.use(
    session({
      store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(authRoutes);
  app.use(expensesRoutes);
  app.use(notesRoutes);
  app.use(progressRoutes);
  app.use(portfolioRoutes);
  app.use(profileRoutes);

  // Error handler must be registered last, after all routers.
  app.use(errorHandler);

  return app;
}
