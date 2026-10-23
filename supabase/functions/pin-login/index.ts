// pin-login — sign in with the app's fixed PIN instead of an emailed code.
//
// POST { pin: "1234" }  →  200 { token_hash }   (client: auth.verifyOtp({ token_hash, type: "magiclink" }))
//                      →  401 { error }          wrong PIN
//                      →  429 { error, retryAfter } locked out / rate limited
//
// Secrets (never in the repo or the app bundle):
//   APP_PIN_HASH    "pbkdf2-sha256:<iterations>:<salt b64url>:<hash b64url>"  (scripts/hash-pin.mjs)
//   APP_USER_EMAIL  the single account this PIN signs into
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (used only here, server-side).
//
// Deploy with --no-verify-jwt (config.toml: verify_jwt = false): callers aren't signed in yet.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = /^(https:\/\/locusjosh\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

function json(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(origin), ...extra },
  });
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number, bytes: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, bytes * 8));
}

/** Constant-time: always touches every byte; length mismatch still compares a full buffer. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i % a.length] ?? 0) ^ (b[i % b.length] ?? 0);
  return diff === 0;
}

async function pinMatches(pin: string, stored: string) {
  const [scheme, iter, salt, hash] = stored.split(":");
  if (scheme !== "pbkdf2-sha256" || !iter || !salt || !hash) throw new Error("APP_PIN_HASH is malformed");
  const expected = b64url(hash);
  const got = await pbkdf2(pin, b64url(salt), Number(iter), expected.length);
  return timingSafeEqual(got, expected);
}

/** Client IP: Cloudflare's header on hosted Supabase, else the proxy chain. */
function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 64);
}

const GENERIC = "Sign-in isn’t available right now.";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !ALLOWED_ORIGIN.test(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const PIN_HASH = Deno.env.get("APP_PIN_HASH");
  const EMAIL = Deno.env.get("APP_USER_EMAIL");
  const URL_ = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!PIN_HASH || !EMAIL || !URL_ || !SERVICE) return json({ error: "PIN sign-in isn’t set up." }, 503, origin);

  let pin = "";
  try {
    const body = await req.json();
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    /* fall through */
  }
  if (!/^\d{4}$/.test(pin)) return json({ error: "Enter the 4-digit code." }, 400, origin);

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = clientIp(req);

  // Count the attempt (atomically) before checking the PIN.
  const { data: gate, error: gateErr } = await admin.rpc("pin_attempt_reserve", { p_ip: ip }).single<{
    allowed: boolean;
    retry_after: number;
    reason: string | null;
  }>();
  if (gateErr || !gate) {
    console.error("pin_attempt_reserve failed", gateErr);
    return json({ error: GENERIC }, 503, origin);
  }
  if (!gate.allowed) {
    return json({ error: GENERIC, retryAfter: gate.retry_after }, 429, origin, { "Retry-After": String(gate.retry_after) });
  }

  let ok = false;
  try {
    ok = await pinMatches(pin, PIN_HASH);
  } catch (e) {
    console.error(e);
    return json({ error: "PIN sign-in isn’t set up." }, 503, origin);
  }
  if (!ok) return json({ error: "Incorrect code." }, 401, origin);

  await admin.rpc("pin_attempt_success", { p_ip: ip });

  // Make sure the account exists and is confirmed (no email is sent by either call).
  const created = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    console.error("createUser failed", created.error);
    return json({ error: GENERIC }, 503, origin);
  }
  // generateLink returns the token without emailing it; only the hash leaves this function.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("generateLink failed", error);
    return json({ error: GENERIC }, 503, origin);
  }
  return json({ token_hash: tokenHash }, 200, origin);
});
