import { describe, it, expect } from 'vitest';
import { extractProfile } from './profile.server';

describe('extractProfile', () => {
	it('uses preferred_username when present', () => {
		const profile = extractProfile(
			{ preferred_username: 'alice', email: 'alice@example.com', email_verified: true },
			'fallback-sub'
		);

		expect(profile).toEqual({
			username: 'alice',
			email: 'alice@example.com',
			email_verified: true
		});
	});

	it('falls back to email when preferred_username is absent', () => {
		const profile = extractProfile({ email: 'bob@example.com' }, 'fallback-sub');

		expect(profile).toEqual({
			username: 'bob@example.com',
			email: 'bob@example.com',
			email_verified: false
		});
	});

	it('falls back to sub when both preferred_username and email are absent', () => {
		const profile = extractProfile({}, 'fallback-sub');

		expect(profile).toEqual({
			username: 'fallback-sub',
			email: null,
			email_verified: false
		});
	});

	it('falls back to sub when claims are undefined', () => {
		const profile = extractProfile(undefined, 'fallback-sub');

		expect(profile).toEqual({
			username: 'fallback-sub',
			email: null,
			email_verified: false
		});
	});

	it('treats email_verified as true only when the claim is literally true', () => {
		const truthyButNotTrue = extractProfile(
			{ email: 'carol@example.com', email_verified: 'true' },
			'fallback-sub'
		);

		expect(truthyButNotTrue.email_verified).toBe(false);
	});
});
