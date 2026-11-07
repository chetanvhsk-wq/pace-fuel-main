const GEMINI_API_KEY_STORAGE_KEY = 'pacefuel_gemini_api_key';

export type GeminiKeySource = 'stored' | 'bundled' | 'missing';

const PLACEHOLDER_PATTERNS = [
  /^my_/i,
  /^your_/i,
  /^paste_/i,
  /^replace_/i,
  /^insert_/i,
  /^change_/i,
  /^example/i,
  /gemini_api_key/i,
];

function normalizeGeminiApiKey(apiKey: string | null | undefined) {
  return (apiKey || '').trim().replace(/^['"]|['"]$/g, '').trim();
}

export function getGeminiApiKeyValidationError(apiKey: string) {
  const normalized = normalizeGeminiApiKey(apiKey);

  if (!normalized) {
    return 'Enter a Gemini API key.';
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'Replace the example text with your real Gemini API key from Google AI Studio.';
  }

  if (/\s/.test(normalized)) {
    return 'Gemini API keys should not contain spaces.';
  }

  if (normalized.length < 20) {
    return 'That Gemini API key looks too short. Paste the full key from Google AI Studio.';
  }

  return null;
}

function getBundledGeminiApiKey() {
  const bundledKey = normalizeGeminiApiKey(process.env.GEMINI_API_KEY);
  return getGeminiApiKeyValidationError(bundledKey) ? '' : bundledKey;
}

export function getConfiguredGeminiApiKey() {
  const bundledKey = getBundledGeminiApiKey();

  if (typeof window === 'undefined') {
    return bundledKey;
  }

  const storedKey = window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim() || '';
  return storedKey || bundledKey;
}

export function getGeminiKeySource(): GeminiKeySource {
  if (typeof window !== 'undefined') {
    const storedKey = window.localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim();
    if (storedKey) {
      return 'stored';
    }
  }

  if (getBundledGeminiApiKey()) {
    return 'bundled';
  }

  return 'missing';
}

export function saveGeminiApiKey(apiKey: string) {
  if (typeof window === 'undefined') {
    return { saved: false, error: 'Gemini keys can only be stored in the browser or APK runtime.' };
  }

  const normalized = normalizeGeminiApiKey(apiKey);
  if (!normalized) {
    window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return { saved: true, error: null };
  }

  const validationError = getGeminiApiKeyValidationError(normalized);
  if (validationError) {
    return { saved: false, error: validationError };
  }

  window.localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, normalized);
  return { saved: true, error: null };
}

export function clearGeminiApiKey() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}
