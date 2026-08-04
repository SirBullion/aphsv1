import nodemailer from "nodemailer";
import { readCookie, verifySessionToken } from "../lib/auth.js";

const MAX_BODY_BYTES = 64 * 1024;
const LIMITS = { date: 10, participant: 150, staff_name: 150, shift_start: 5, shift_end: 5, notes: 3000 };

function json(response, status, payload) {
  return response.status(status).json(payload);
}

async function rawBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const type = String(request.headers["content-type"] || "");
  const buffer = Buffer.isBuffer(request.body) ? request.body : await rawBody(request);
  if (type.includes("application/json")) return JSON.parse(buffer.toString("utf8") || "{}");
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(buffer.toString("utf8")));
  }

  const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
  if (!boundary) throw new Error("INVALID_BODY");
  const fields = {};
  for (const part of buffer.toString("utf8").split(`--${boundary}`)) {
    const match = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").replace(/[<>]/g, "").replace(/\r\n?/g, "\n").trim();
}

function cleanSingleLine(value) {
  return cleanText(value).replace(/[\n\t]+/g, " ").replace(/\s{2,}/g, " ");
}

function validate(body) {
  const fields = {};
  const errors = [];
  for (const [name, maximum] of Object.entries(LIMITS)) {
    fields[name] = name === "notes" ? cleanText(body[name]) : cleanSingleLine(body[name]);
    if (!fields[name]) errors.push({ field: name, message: `${name.replaceAll("_", " ")} is required.` });
    else if (fields[name].length > maximum) errors.push({ field: name, message: `${name.replaceAll("_", " ")} is too long.` });
  }
  if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) errors.push({ field: "date", message: "Date is invalid." });
  for (const name of ["shift_start", "shift_end"]) {
    if (fields[name] && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fields[name])) {
      errors.push({ field: name, message: "Shift time is invalid." });
    }
  }
  return { fields, errors };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const token = readCookie(request.headers.cookie, "shift_session");
  if (!(await verifySessionToken(token, process.env.SESSION_SECRET))) {
    return json(response, 401, { error: "Your session has expired. Please sign in again." });
  }
  if (!process.env.ZOHO_SMTP_USER || !process.env.ZOHO_SMTP_APP_PASSWORD || !process.env.SHIFT_NOTES_EMAIL_TO) {
    return json(response, 500, { error: "Shift note email delivery is not configured." });
  }

  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    return json(response, error.message === "BODY_TOO_LARGE" ? 413 : 400, { error: "The submitted form could not be read." });
  }
  const { fields, errors } = validate(body);
  if (errors.length) return json(response, 422, { errors });

  const emailText = [
    `Date: ${fields.date}`,
    `Participant: ${fields.participant}`,
    `Shift Time: ${fields.shift_start} - ${fields.shift_end}`,
    `Staff Name: ${fields.staff_name}`,
    "",
    "Notes:",
    fields.notes,
  ].join("\n");

  try {
    const transport = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || "smtp.zoho.com",
      port: Number(process.env.ZOHO_SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.ZOHO_SMTP_USER,
        pass: process.env.ZOHO_SMTP_APP_PASSWORD,
      },
    });
    await transport.sendMail({
      from: process.env.ZOHO_SMTP_USER,
      to: process.env.SHIFT_NOTES_EMAIL_TO,
      subject: `Shift Note - ${fields.participant} - ${fields.date}`,
      text: emailText,
    });
    return json(response, 200, { ok: true, message: "Shift note submitted successfully." });
  } catch (error) {
    console.error("SMTP send failed:", error.message, error.code);
    return json(response, 500, { error: "The shift note could not be emailed. Please try again." });
  }
}
