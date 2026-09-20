/**
 * Create a backoffice account (or reset one with --reset).
 *
 *   npm run admin:create -- --email you@company.com --name "Your Name"
 *   npm run admin:create -- --email you@company.com --name "Your Name" --role admin --password "S3cure-pass!"
 *   npm run admin:create -- --email you@company.com --reset
 *
 * Without --password a strong password is generated and printed once.
 */
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";

import { hash } from "bcryptjs";

import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/roles";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connect";
import { Admin } from "@/lib/db/models/admin";

function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Variables may come from the shell instead.
  }
}

function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%*-_";
  const all = letters + digits + symbols;
  const chars = Array.from({ length: 16 }, () => all[randomInt(all.length)]);
  chars[2] = digits[randomInt(digits.length)];
  chars[7] = letters[randomInt(letters.length)];
  chars[11] = symbols[randomInt(symbols.length)];
  return chars.join("");
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main() {
  loadEnv();
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string", default: "super_admin" },
      password: { type: "string" },
      reset: { type: "boolean", default: false },
    },
  });

  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Pass a valid --email.");
  if (!isAdminRole(values.role)) fail(`--role must be one of: ${ADMIN_ROLES.join(", ")}.`);

  const password = values.password ?? generatePassword();
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail("The password needs at least 10 characters, with letters and numbers.");
  }

  await connectToDatabase();
  const existing = await Admin.findOne({ email });
  const passwordHash = await hash(password, 12);

  if (existing) {
    if (!values.reset) fail(`${email} already exists. Use --reset to set a new password.`);
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    existing.failedLoginCount = 0;
    existing.lockedUntil = null;
    existing.sessionVersion += 1;
    await existing.save();
    console.log(`\n✔ Password reset for ${email} (${existing.role}).`);
  } else {
    const name = values.name?.trim();
    if (!name || name.length < 2) fail("Pass the person's --name.");
    await Admin.create({ email, name, role: values.role, passwordHash });
    console.log(`\n✔ Created ${values.role} account for ${name} <${email}>.`);
  }

  if (!values.password) {
    console.log(`\n  Temporary password: ${password}\n  Sign in at /admin/login and change it from "My account".\n`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
