import type { AppUser } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

export {};
