import "server-only";

/**
 * Outgoing SMS. No provider is wired yet, so this logs the message and reports
 * that nothing was delivered — the caller decides what that means (in
 * development a code is handed back over the API; in production sign-in fails
 * loudly rather than leaving people waiting for a text that never arrives).
 *
 * To go live, implement one branch here — Twilio, Vonage, or a Tunisian
 * aggregator such as Orange or Tunisie Telecom — and set SMS_PROVIDER.
 * Nothing else in the codebase needs to change.
 */

export type SmsResult = { delivered: boolean; provider: string };

export function smsConfigured() {
  return Boolean(process.env.SMS_PROVIDER);
}

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    // Masked: the last digits are enough to match a log line to a tester.
    console.info(`[sms] no provider configured — would send to ${maskPhone(to)}: ${text}`);
    return { delivered: false, provider: "none" };
  }

  throw new Error(`[sms] SMS_PROVIDER="${provider}" is set but no integration is implemented.`);
}

export function maskPhone(phone: string) {
  return phone.length > 4 ? `${"•".repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
}

/** The only message the platform sends today. */
export function verificationMessage(code: string) {
  return `Doura Go: ${code} is your verification code. It expires in 5 minutes.`;
}
