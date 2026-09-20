import "server-only";

/**
 * Outgoing SMS.
 *
 * One verification code is the only message the platform sends, so this stays
 * deliberately small. Which provider carries it is an environment variable:
 *
 *   SMS_PROVIDER=twilio     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SENDER
 *   SMS_PROVIDER=http       SMS_ENDPOINT, SMS_API_KEY  — for a local aggregator
 *   unset                   nothing is sent; the code is logged instead
 *
 * With nothing configured the code is logged and, outside production, handed
 * back through the API so the apps can be built against a real server. In
 * production, sign-in then fails loudly rather than leaving people waiting for
 * a text that never arrives.
 */

export type SmsResult = { delivered: boolean; provider: string };

const TIMEOUT_MS = 8000;

export function smsConfigured() {
  return Boolean(process.env.SMS_PROVIDER?.trim());
}

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER?.trim();

  if (!provider) {
    // Masked: the last digits are enough to match a log line to a tester.
    console.info(`[sms] no provider configured — would send to ${maskPhone(to)}: ${text}`);
    return { delivered: false, provider: "none" };
  }

  try {
    if (provider === "twilio") return await sendViaTwilio(to, text);
    if (provider === "http") return await sendViaHttp(to, text);
    console.error(`[sms] unknown SMS_PROVIDER "${provider}"`);
    return { delivered: false, provider };
  } catch (error) {
    // A provider having a bad moment is not a reason to lose the request; the
    // caller decides what an undelivered code means.
    console.error(`[sms] ${provider} failed for ${maskPhone(to)}`, error);
    return { delivered: false, provider };
  }
}

/**
 * Twilio's Messages endpoint — form-encoded, basic auth, no SDK needed for one
 * call. Works from Tunisia and is the quickest way to be sending for real;
 * a local aggregator is usually cheaper per message once volume arrives.
 */
async function sendViaTwilio(to: string, text: string): Promise<SmsResult> {
  const sid = required("TWILIO_ACCOUNT_SID");
  const token = required("TWILIO_AUTH_TOKEN");
  // A phone number you own, or an alphanumeric sender id where it is allowed.
  const from = required("TWILIO_SENDER");

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[sms] twilio ${response.status}`, detail.slice(0, 300));
    return { delivered: false, provider: "twilio" };
  }
  return { delivered: true, provider: "twilio" };
}

/**
 * A plain JSON POST, for the Tunisian aggregators that all offer some version
 * of one. Adjust the body to match whichever you sign with — the shape below
 * is the common denominator.
 */
async function sendViaHttp(to: string, text: string): Promise<SmsResult> {
  const endpoint = required("SMS_ENDPOINT");
  const key = process.env.SMS_API_KEY?.trim();

  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ to, message: text, sender: process.env.SMS_SENDER ?? "DouraGo" }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[sms] http ${response.status}`, detail.slice(0, 300));
    return { delivered: false, provider: "http" };
  }
  return { delivered: true, provider: "http" };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when SMS_PROVIDER is set`);
  return value;
}

export function maskPhone(phone: string) {
  return phone.length > 4 ? `${"•".repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
}

/**
 * The only message the platform sends. Keep the brand name in it: Android and
 * iOS both use it to offer the code as a one-tap autofill.
 */
export function verificationMessage(code: string) {
  return `Doura Go: ${code} is your verification code. It expires in 5 minutes.`;
}
