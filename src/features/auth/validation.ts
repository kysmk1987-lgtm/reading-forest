/** Pure sign-in / sign-up validation and error classification (no React Native imports — unit tested). */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;
export const PASSWORD_MIN = 8;
/** bcrypt (Supabase Auth) only looks at the first 72 bytes. */
export const PASSWORD_MAX = 72;

export type FieldError =
  | 'emailRequired'
  | 'emailInvalid'
  | 'nicknameRequired'
  | 'nicknameLength'
  | 'passwordRequired'
  | 'passwordShort'
  | 'passwordLong'
  | 'passwordWeak'
  | 'confirmRequired'
  | 'confirmMismatch'
  | 'termsRequired'
  | 'privacyRequired';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): FieldError | null {
  const value = email.trim();
  if (!value) return 'emailRequired';
  if (value.length > 254 || !EMAIL_RE.test(value)) return 'emailInvalid';
  return null;
}

export function validateNickname(nickname: string): FieldError | null {
  const value = nickname.trim();
  if (!value) return 'nicknameRequired';
  if ([...value].length < NICKNAME_MIN || [...value].length > NICKNAME_MAX) return 'nicknameLength';
  return null;
}

/** Sign-up rule: 8–72 characters with at least one letter and one number. */
export function validateNewPassword(password: string): FieldError | null {
  if (!password) return 'passwordRequired';
  if (password.length < PASSWORD_MIN) return 'passwordShort';
  if (password.length > PASSWORD_MAX) return 'passwordLong';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'passwordWeak';
  return null;
}

export function validateConfirm(password: string, confirm: string): FieldError | null {
  if (!confirm) return 'confirmRequired';
  return password === confirm ? null : 'confirmMismatch';
}

export interface SignUpInput {
  email: string;
  nickname: string;
  password: string;
  confirm: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

export type SignUpErrors = Partial<Record<'email' | 'nickname' | 'password' | 'confirm' | 'terms' | 'privacy', FieldError>>;

export function validateSignUp(input: SignUpInput): SignUpErrors {
  const errors: SignUpErrors = {};
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const nickname = validateNickname(input.nickname);
  if (nickname) errors.nickname = nickname;
  const password = validateNewPassword(input.password);
  if (password) errors.password = password;
  const confirm = validateConfirm(input.password, input.confirm);
  if (confirm) errors.confirm = confirm;
  if (!input.agreeTerms) errors.terms = 'termsRequired';
  if (!input.agreePrivacy) errors.privacy = 'privacyRequired';
  return errors;
}

/** Server / network failures shown on the auth screens. */
export type AuthFailure =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'userExists'
  | 'weakPassword'
  | 'samePassword'
  | 'rateLimited'
  | 'emailDisabled'
  | 'signupDisabled'
  | 'providerDisabled'
  /** OAuth provider gave no e-mail (typical for Kakao without a business-verified app). */
  | 'providerEmail'
  | 'network'
  | 'sessionMissing'
  | 'notConfigured'
  | 'unknown';

/** Maps a Supabase AuthError (or fetch failure) to a user-facing failure kind. */
export function classifyAuthError(error: unknown): AuthFailure {
  if (!error) return 'unknown';
  const e = error as { code?: string; name?: string; status?: number; message?: string };
  const code = e.code ?? '';
  const message = (e.message ?? '').toLowerCase();
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || message.includes('failed to fetch') || message.includes('network request failed')) {
    return 'network';
  }
  switch (code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'userExists';
    case 'weak_password':
      return 'weakPassword';
    case 'same_password':
      return 'samePassword';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
    case 'email_provider_disabled':
      return 'emailDisabled';
    case 'signup_disabled':
      return 'signupDisabled';
    case 'provider_disabled':
    case 'oauth_provider_not_supported':
    case 'manual_linking_disabled':
      return 'providerDisabled';
    case 'session_not_found':
    case 'session_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'otp_expired':
    case 'bad_code_verifier':
      return 'sessionMissing';
  }
  if (e.name === 'AuthSessionMissingError') return 'sessionMissing';
  if (message.includes('invalid login credentials')) return 'invalidCredentials';
  if (message.includes('email not confirmed')) return 'emailNotConfirmed';
  if (message.includes('already registered')) return 'userExists';
  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) return 'providerDisabled';
  if (e.status === 429) return 'rateLimited';
  return 'unknown';
}
