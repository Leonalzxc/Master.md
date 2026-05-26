import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeRedirectPath } from './redirect';

const fallback = '/ru/account';

test('getSafeRedirectPath keeps local application paths', () => {
  assert.equal(getSafeRedirectPath('/ru/jobs/123?tab=bids', fallback), '/ru/jobs/123?tab=bids');
});

test('getSafeRedirectPath rejects absolute and scheme-relative redirects', () => {
  assert.equal(getSafeRedirectPath('https://evil.example', fallback), fallback);
  assert.equal(getSafeRedirectPath('//evil.example/login', fallback), fallback);
});

test('getSafeRedirectPath rejects encoded scheme-relative redirects', () => {
  assert.equal(getSafeRedirectPath('/%2fevil.example/login', fallback), fallback);
  assert.equal(getSafeRedirectPath('/%5cevil.example/login', fallback), fallback);
});

test('getSafeRedirectPath rejects ambiguous whitespace and control characters', () => {
  assert.equal(getSafeRedirectPath(' /ru/account', fallback), fallback);
  assert.equal(getSafeRedirectPath('/ru/account\nSet-Cookie:x=y', fallback), fallback);
});
