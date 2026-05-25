"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithProvider(providerId: string, callbackUrl?: string) {
  await signIn(providerId, { redirectTo: callbackUrl ?? "/feed" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
