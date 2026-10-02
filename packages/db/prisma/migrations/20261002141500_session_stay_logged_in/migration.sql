-- Nullable on purpose: existing sessions stay NULL and keep their stored expiresAt.
ALTER TABLE "Session" ADD COLUMN "stayLoggedIn" BOOLEAN;
