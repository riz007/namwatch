import "server-only";

import { cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";

/**
 * Device identity for rate limiting and one-vote-per-device..
 *
 * "The device ID is a random UUID stored in a signed httpOnly cookie. The server
 * stores only sha256(deviceId + SERVER_SALT)." The raw id never reaches the
 * database and is never logged.
 */

const COOKIE = "nw_did";
const ONE_YEAR_S = 31_536_000;

function salted(value: string): string {
  const salt = process.env.SERVER_SALT;
  if (!salt)
    throw new Error(
      "SERVER_SALT is not set — refusing to store an unsalted hash",
    );
  return createHash("sha256").update(`${value}${salt}`).digest("hex");
}

/** Reads the device cookie, minting one if this is a first visit. */
export async function deviceHash(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;

  if (!id) {
    id = randomUUID();
    jar.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_S,
    });
  }

  return salted(id);
}

/**
 * Hashed client IP, for the second rate-limit dimension. stored
 * hashed, kept 7 days, used for rate limiting only.
 */
export function ipHash(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  if (!ip) return null;
  return salted(ip);
}
