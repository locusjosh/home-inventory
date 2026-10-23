#!/usr/bin/env node
// Generate APP_PIN_HASH for the pin-login Edge Function.
// The PIN is read from a hidden prompt (or stdin when piped) — never pass it as an argument,
// never commit it, and never commit the output. Output goes straight into `supabase secrets set`.
//
//   node scripts/hash-pin.mjs                  # prompts, prints APP_PIN_HASH=…
//   printf '%s' "$PIN" | node scripts/hash-pin.mjs
import { pbkdf2Sync, randomBytes } from "node:crypto";
import readline from "node:readline";

const ITERATIONS = 600_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function readPin() {
  if (!process.stdin.isTTY) {
    let s = "";
    for await (const chunk of process.stdin) s += chunk;
    return s.trim();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  rl._writeToOutput = (str) => { if (!str.includes("\n") && str !== "PIN: ") return; process.stderr.write(str); };
  const pin = await new Promise((res) => rl.question("PIN: ", res));
  rl.close();
  process.stderr.write("\n");
  return pin.trim();
}

const pin = await readPin();
if (!/^\d{4}$/.test(pin)) {
  console.error("The PIN must be exactly 4 digits.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(pin, salt, ITERATIONS, 32, "sha256");
process.stdout.write(`APP_PIN_HASH=pbkdf2-sha256:${ITERATIONS}:${b64url(salt)}:${b64url(hash)}\n`);
