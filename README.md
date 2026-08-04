# APHS Static Website

Static website for **All People Holistic Support**.

## Stack

- HTML (`index.html`, `about.html`, `services.html`, `refer.html`, `careers.html`, `contact.html`, `feedback.html`, `complaint.html`)
- CSS (`style.css`)
- Vanilla JS (`site.js`)
- Public form handling via Formspree
- Staff shift notes via authenticated Vercel Functions and Zoho Mail SMTP

## Project Structure

- `index.html`: Home page
- `about.html`: About page
- `services.html`: Services page
- `refer.html`: Referral form page
- `careers.html`: Careers expression-of-interest page
- `contact.html`: Contact form page
- `feedback.html`: Feedback form page
- `complaint.html`: Complaint form page
- `login.html`: Unlisted staff login page
- `shift-notes.html`: Unlisted, authenticated staff shift-note form
- `middleware.js`: Server-side authentication gate for `/shift-notes.html` only
- `api/login.js`: Password login and signed session-cookie endpoint
- `api/submit-shift-note.js`: Authenticated validation and Zoho Mail SMTP delivery
- `lib/auth.js`: Shared HMAC session signing and verification
- `style.css`: Shared styles
- `site.js`: Shared JS for:
  - dynamic footer year (`.js-current-year`)
  - AJAX form submit handling (`data-ajax-form`)
  - success/error status messages
- `logo.png`, `favicon.png`, `bg.gif`: Site assets

## Staff Shift Notes

The unlisted `/shift-notes.html` page is protected by Vercel Edge Middleware. The middleware runs only for that exact path and verifies the signed, eight-hour `shift_session` cookie. Visitors without a valid session are redirected to `/login.html?redirect=/shift-notes.html`.

The login API compares the supplied password in constant time, applies basic per-instance rate limiting, and sets an HTTP-only, Secure, SameSite=Strict cookie. Shift-note submissions are authenticated again in the serverless handler, validated and sanitized server-side, then emailed through Zoho Mail SMTP. Participant names are entered as plain text and are never embedded in the page source.

Required environment variables are documented in [`.env.example`](.env.example):

- `SESSION_SECRET`
- `SHIFT_NOTES_PASSWORD`
- `ZOHO_SMTP_HOST`
- `ZOHO_SMTP_PORT`
- `ZOHO_SMTP_USER`
- `ZOHO_SMTP_APP_PASSWORD`
- `SHIFT_NOTES_EMAIL_TO`


## Setup Steps

1. In Zoho Accounts, generate an app-specific password for the sending mailbox under Security > App Passwords: https://accounts.zoho.com/home#security/app_password
2. Confirm the SMTP host and SSL port for the Zoho account data center. The common defaults are `smtp.zoho.com` and port `465`, but regional accounts may differ.
3. Choose a strong, unique staff password for `SHIFT_NOTES_PASSWORD`.
4. Generate a long random `SESSION_SECRET` (at least 32 random bytes; do not reuse the staff password).
5. In the Vercel project dashboard, add `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER`, and `ZOHO_SMTP_APP_PASSWORD` from [`.env.example`](.env.example), along with `SESSION_SECRET`, `SHIFT_NOTES_PASSWORD`, and `SHIFT_NOTES_EMAIL_TO`, for Production and any Preview environments you use.
6. Redeploy the Vercel project so the functions and middleware receive the new environment variables.
7. Visit `/shift-notes.html`, confirm it redirects to login, sign in, submit a test note, and verify that it arrives at the destination inbox.

## Deploy

This is deployable as-is to any static host:

- Netlify
- Cloudflare Pages
- GitHub Pages
- cPanel static hosting
- S3 + CloudFront

Deploy by uploading the full `APHS` folder contents.

## Forms

All forms post to Formspree endpoint:

- `https://formspree.io/f/mwpbzdal`

Each form includes hidden routing fields:

- `form_type`
- `source_page`

This lets you filter submissions by form in Formspree/email automation.

## SEO

Each page includes:

- `canonical`
- Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:locale`)

Twitter tags were intentionally removed.

Current production domain in metadata:

- `https://aphsnt.com.au`

If domain changes, update:

- `canonical` links
- `og:url`
- `og:image`

## Content Updates

Common updates:

- Navigation labels/links: update header nav in each HTML file
- Footer text: update in each HTML file
- Colors/spacing/typography: update `style.css`
- Form success/error text: update `data-success-message` in form tags or `site.js`

## Accessibility and UX

Implemented:

- Keyboard focus styles via `:focus-visible`
- `aria-current="page"` on active nav links
- `aria-live="polite"` form status messages
- Disabled submit button while request is in progress

## Notes

- The staff shift-note feature requires Vercel Functions, Vercel Middleware, and the environment variables above.
- If Formspree endpoint changes, update all form `action` attributes.
- Keep files ASCII/plain UTF-8 text.
