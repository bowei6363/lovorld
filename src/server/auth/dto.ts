/**
 * Data Transfer Objects: tighten what reaches the client. Whenever we return
 * a user-shaped object to a component or Route Handler, route it through here
 * so secrets (internal IDs we don't want to leak, etc.) cannot slip out by
 * accident.
 *
 * Inputs are typed as `Pick<User, ...>` so DAL callers can pass thin selects
 * directly without first hydrating the full User row.
 */
import "server-only";

import type { User } from "@/server/db/schema/auth";

type PublicSource = Pick<User, "id" | "name" | "image" | "handle" | "bio">;
type OwnSource = PublicSource & Pick<User, "email">;

export type PublicProfile = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  bio: string | null;
};

export type OwnProfile = PublicProfile & {
  email: string;
};

export function toPublicProfile(user: PublicSource): PublicProfile {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    handle: user.handle,
    bio: user.bio,
  };
}

export function toOwnProfile(user: OwnSource): OwnProfile {
  return {
    ...toPublicProfile(user),
    email: user.email,
  };
}
