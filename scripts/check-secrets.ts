/**
 * Fails if a tracked file carries something that looks like a real credential.
 *
 * `.env.example` documents which variables exist; it must never hold a value.
 * The wider scan catches a key pasted into source or committed by accident.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const problems: string[] = [];

if (existsSync(".env.example")) {
  const filled = readFileSync(".env.example", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_][A-Z0-9_]*=.+$/.test(l.trim()))
    .map((l) => l.split("=")[0]!);
  for (const key of filled) {
    problems.push(
      `.env.example has a value for ${key} — it must list keys only`,
    );
  }
}

/** Shapes worth refusing outright, whatever file they appear in. */
const SIGNATURES: { name: string; re: RegExp }[] = [
  {
    name: "Postgres connection string with a password",
    re: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
  },
  {
    name: "Supabase key",
    re: /\b(?:sb_secret_|sb_publishable_|sbp_)[A-Za-z0-9_-]{16,}/,
  },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "Private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter(
    (f) =>
      !f.startsWith("pnpm-lock") &&
      !f.includes("fixtures/") &&
      f !== "scripts/check-secrets.ts",
  );

for (const file of tracked) {
  let body: string;
  try {
    body = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of SIGNATURES) {
    const m = re.exec(body);
    if (m) {
      const line = body.slice(0, m.index).split("\n").length;
      problems.push(`${file}:${line} looks like a ${name}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ possible secrets in tracked files (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `✓ no credential-shaped strings in ${tracked.length} tracked files`,
);
