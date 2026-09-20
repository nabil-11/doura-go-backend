// Phone numbers that sign in with a fixed code and no SMS.
//
// Two jobs: testing the apps without a phone in your hand, and giving Apple and
// Google a working account when they review a release — reviewers cannot
// receive a Tunisian text message, and a build they can't sign into is rejected.
//
// Configured through TEST_PHONE_NUMBERS, so the list ships with the deployment
// rather than the code, and an environment with none set has none.
//
//   TEST_PHONE_NUMBERS=+21610000001:483920,+21610000002:774615

import { normalizePhone } from "../domain/driver";

type TestNumbers = Map<string, string>;

let parsed: TestNumbers | null = null;
let parsedFrom: string | undefined;

function load(): TestNumbers {
  const raw = process.env.TEST_PHONE_NUMBERS;
  if (parsed && parsedFrom === raw) return parsed;

  const numbers: TestNumbers = new Map();
  for (const entry of (raw ?? "").split(",")) {
    const [phone, code] = entry.split(":").map((part) => part?.trim());
    if (!phone || !code) continue;
    if (!/^\d{6}$/.test(code)) {
      console.warn(`[auth] ignoring test number ${phone}: the code must be six digits`);
      continue;
    }
    numbers.set(normalizePhone(phone), code);
  }

  parsed = numbers;
  parsedFrom = raw;
  return numbers;
}

/** The fixed code for a test number, or null for an ordinary one. */
export function testCodeFor(phone: string): string | null {
  return load().get(normalizePhone(phone)) ?? null;
}

export function isTestNumber(phone: string) {
  return load().has(normalizePhone(phone));
}
