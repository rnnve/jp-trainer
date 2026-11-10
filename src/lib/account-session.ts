import { auth, clerkClient } from "@clerk/nextjs/server";
import { clerkConfigured } from "./auth-policy";
export async function accountId(): Promise<string | null> {
  if (!clerkConfigured()) return null;
  const { userId } = await auth({ acceptsToken: "session_token" });
  return userId;
}
export async function accountProfile(userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email:
      user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
      )?.emailAddress ?? null,
    imageUrl: user.imageUrl,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
