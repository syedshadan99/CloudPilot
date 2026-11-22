import { createHash, randomBytes } from "node:crypto";

export interface GeneratedToken {
  raw: string;
  hash: string;
}

export function generateToken(): GeneratedToken {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
