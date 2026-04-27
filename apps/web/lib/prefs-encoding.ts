import { PreferencesSchema, type Preferences } from "@scout/core/schemas";

/**
 * Preferences live in the URL so results pages are refreshable and shareable.
 * We base64url-encode JSON to keep URLs reasonably short and opaque.
 */
export function encodePrefs(prefs: Preferences): string {
  const json = JSON.stringify(prefs);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodePrefs(encoded: string): Preferences | null {
  if (!encoded) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window === "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : atobToString(padded);
    const parsed = JSON.parse(json);
    const result = PreferencesSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function atobToString(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
