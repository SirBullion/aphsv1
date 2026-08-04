import { timingSafeEqual } from "node:crypto";
import { createSessionToken } from "../lib/auth.js";

const failedAttempts = new Map();
const MAX_FAILURES = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

// This in-memory limiter resets on a serverless cold start. Use a durable store
// such as Vercel KV if stronger, instance-independent protection is required.
function clientIp(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function passwordsMatch(supplied, expected) {
  const suppliedBuffer = Buffer.from(String(supplied || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function json(response, status, payload) {
  return response.status(status).json(payload);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }
  if (!process.env.SHIFT_NOTES_PASSWORD || !process.env.SESSION_SECRET) {
    return json(response, 500, { error: "Login is not configured." });
  }

  const ip = clientIp(request);
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (record?.blockedUntil > now) {
    return json(response, 401, { error: "Unable to sign in. Check the password and try again later." });
  }
  if (record && record.blockedUntil <= now) failedAttempts.delete(ip);

  let body = request.body || {};
  try {
    if (typeof body === "string") body = JSON.parse(body);
  } catch {
    return json(response, 400, { error: "Unable to sign in. Check the password and try again later." });
  }

  if (!passwordsMatch(body.password, process.env.SHIFT_NOTES_PASSWORD)) {
    const failures = (failedAttempts.get(ip)?.failures || 0) + 1;
    failedAttempts.set(ip, {
      failures,
      blockedUntil: failures >= MAX_FAILURES ? now + BLOCK_DURATION_MS : 0,
    });
    return json(response, 401, { error: "Unable to sign in. Check the password and try again later." });
  }

  failedAttempts.delete(ip);
  const token = await createSessionToken(process.env.SESSION_SECRET, now);
  response.setHeader(
    "Set-Cookie",
    `shift_session=${encodeURIComponent(token)}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Strict`
  );
  return json(response, 200, { ok: true });
}
