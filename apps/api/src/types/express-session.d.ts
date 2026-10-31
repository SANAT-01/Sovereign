declare global {
  namespace Express {
    // Augment Express.User (used by Passport's req.user / req.isAuthenticated)
    // with our shared users table row shape.
    interface User {
      id: string;
      google_sub: string;
      email: string;
      display_name: string | null;
      created_at: Date;
    }
  }
}

export {};
