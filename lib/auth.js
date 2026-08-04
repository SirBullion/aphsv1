const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function signatureFor(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

export async function createSessionToken(secret, now = Date.now()) {
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  const expiresAt = String(now + SESSION_DURATION_MS);
  return `${expiresAt}.${await signatureFor(expiresAt, secret)}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const separator = token.indexOf(".");
  if (separator === -1) return false;

  const expiresAt = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= now || !/^[a-f0-9]{64}$/.test(suppliedSignature)) {
    return false;
  }

  return constantTimeEqual(suppliedSignature, await signatureFor(expiresAt, secret));
}

export function readCookie(cookieHeader, name) {
  if (!cookieHeader) return "";
  for (const pair of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = pair.trim().split("=");
    if (cookieName === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}
