import { getEnv, TURNSTILE_TEST_SECRET } from '../env';

export type CaptchaVerifier = (token: string, ip: string) => Promise<boolean>;

/** Verifies a Cloudflare Turnstile token on the server. */
export function turnstileVerifier(secret: string): CaptchaVerifier {
  return async (token, ip) => {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== 'unknown') body.set('remoteip', ip);
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body,
      });
      const result = (await res.json()) as { success?: boolean };
      return result.success === true;
    } catch {
      return false;
    }
  };
}

export function getCaptchaVerifier(): CaptchaVerifier {
  return turnstileVerifier(getEnv().TURNSTILE_SECRET_KEY ?? TURNSTILE_TEST_SECRET);
}
