/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Turnstile site key; defaults to Cloudflare's always-pass test key. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
