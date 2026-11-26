import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "oauth_state";

/** Creates an anti-forgery state value and stores it in a short-lived cookie. */
export async function newState(provider: string): Promise<string> {
  const state = `${provider}.${crypto.randomBytes(16).toString("hex")}`;
  (await cookies()).set(COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return state;
}

export async function checkState(provider: string, state: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  return Boolean(state && expected && state === expected && state.startsWith(`${provider}.`));
}
