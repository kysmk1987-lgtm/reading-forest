/**
 * Offline tests for sign-up / sign-in validation and Supabase error classification.
 * Run: npm run test:auth
 */
import assert from 'node:assert/strict';

import {
  classifyAuthError,
  normalizeEmail,
  validateConfirm,
  validateEmail,
  validateNewPassword,
  validateNickname,
  validateSignUp,
} from '../src/features/auth/validation';

// e-mail
assert.equal(validateEmail(''), 'emailRequired');
assert.equal(validateEmail('   '), 'emailRequired');
assert.equal(validateEmail('reader'), 'emailInvalid');
assert.equal(validateEmail('reader@forest'), 'emailInvalid');
assert.equal(validateEmail('reader @forest.kr'), 'emailInvalid');
assert.equal(validateEmail(' reader@forest.kr '), null);
assert.equal(normalizeEmail(' Reader@Forest.KR '), 'reader@forest.kr');

// nickname (2–16 characters, counted by code point)
assert.equal(validateNickname(''), 'nicknameRequired');
assert.equal(validateNickname('숲'), 'nicknameLength');
assert.equal(validateNickname('숲속'), null);
assert.equal(validateNickname('가'.repeat(16)), null);
assert.equal(validateNickname('가'.repeat(17)), 'nicknameLength');
assert.equal(validateNickname('🌳🌳'), null);

// password: 8–72 chars, letters + numbers
assert.equal(validateNewPassword(''), 'passwordRequired');
assert.equal(validateNewPassword('abc123'), 'passwordShort');
assert.equal(validateNewPassword('abcdefgh'), 'passwordWeak');
assert.equal(validateNewPassword('12345678'), 'passwordWeak');
assert.equal(validateNewPassword('forest2026'), null);
assert.equal(validateNewPassword(`a1${'x'.repeat(71)}`), 'passwordLong');
assert.equal(validateConfirm('forest2026', ''), 'confirmRequired');
assert.equal(validateConfirm('forest2026', 'forest2027'), 'confirmMismatch');
assert.equal(validateConfirm('forest2026', 'forest2026'), null);

// whole form
assert.deepEqual(
  validateSignUp({ email: 'a@b.kr', nickname: '도토리', password: 'forest2026', confirm: 'forest2026', agreeTerms: true, agreePrivacy: true }),
  {},
);
assert.deepEqual(validateSignUp({ email: '', nickname: '', password: 'x', confirm: 'y', agreeTerms: false, agreePrivacy: true }), {
  email: 'emailRequired',
  nickname: 'nicknameRequired',
  password: 'passwordShort',
  confirm: 'confirmMismatch',
  terms: 'termsRequired',
});

// Supabase errors
assert.equal(classifyAuthError({ code: 'invalid_credentials', status: 400 }), 'invalidCredentials');
assert.equal(classifyAuthError({ message: 'Invalid login credentials', status: 400 }), 'invalidCredentials');
assert.equal(classifyAuthError({ code: 'email_not_confirmed' }), 'emailNotConfirmed');
assert.equal(classifyAuthError({ code: 'user_already_exists' }), 'userExists');
assert.equal(classifyAuthError({ code: 'over_email_send_rate_limit', status: 429 }), 'rateLimited');
assert.equal(classifyAuthError({ status: 429 }), 'rateLimited');
assert.equal(classifyAuthError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }), 'network');
assert.equal(classifyAuthError(new TypeError('Failed to fetch')), 'network');
assert.equal(classifyAuthError({ message: 'Unsupported provider: provider is not enabled', status: 400 }), 'providerDisabled');
assert.equal(classifyAuthError({ code: 'weak_password' }), 'weakPassword');
assert.equal(classifyAuthError({ code: 'flow_state_expired' }), 'sessionMissing');
assert.equal(classifyAuthError({ message: 'boom' }), 'unknown');

console.log('auth validation tests passed');
