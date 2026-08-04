import { next } from "@vercel/functions";
import { readCookie, verifySessionToken } from "./lib/auth.js";

export default async function middleware(request) {
  const token = readCookie(request.headers.get("cookie"), "shift_session");
  if (await verifySessionToken(token, process.env.SESSION_SECRET)) {
    return next();
  }

  return Response.redirect(new URL("/login.html?redirect=/shift-notes.html", request.url), 302);
}

// The exact matcher excludes every route except /shift-notes.html.
export const config = {
  matcher: "/shift-notes.html",
};
