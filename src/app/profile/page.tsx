import { getCurrentUser } from "@/server/auth/dal";
import { toOwnProfile } from "@/server/auth/dto";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  // verifySession() inside getCurrentUser() redirects to /sign-in when the
  // visitor is unauthenticated, so by this line we always have a user.
  const user = await getCurrentUser();
  if (!user) return null;

  const me = toOwnProfile(user);

  return (
    <section className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16">
            {me.image ? <AvatarImage src={me.image} alt={me.name ?? "Avatar"} /> : null}
            <AvatarFallback>{(me.name ?? me.email).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <CardTitle className="text-xl">{me.name ?? "Anonymous"}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {me.handle ? `@${me.handle}` : me.email}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {me.bio ? (
            <p className="leading-relaxed">{me.bio}</p>
          ) : (
            <p className="text-muted-foreground">
              No bio yet. (Profile editor lands in a later milestone.)
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
