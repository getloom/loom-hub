import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { OIDC_CLIENTID: 'loom-app' }
}));

const { extractRoles, hasAnyRole, requireRole } = await import('./roles.server');

describe('extractRoles', () => {
	it('reads realm_access.roles', () => {
		const roles = extractRoles({ realm_access: { roles: ['founder'] } });

		expect(roles).toEqual(['founder']);
	});

	it('reads resource_access.<OIDC_CLIENTID>.roles', () => {
		const roles = extractRoles({
			resource_access: { 'loom-app': { roles: ['leader'] } }
		});

		expect(roles).toEqual(['leader']);
	});

	it('merges and dedups realm and client roles', () => {
		const roles = extractRoles({
			realm_access: { roles: ['founder', 'member'] },
			resource_access: { 'loom-app': { roles: ['founder', 'leader'] } }
		});

		expect(roles.sort()).toEqual(['founder', 'leader', 'member']);
	});

	it('returns [] for missing claims', () => {
		expect(extractRoles(undefined)).toEqual([]);
	});

	it('returns [] for malformed role shapes', () => {
		const roles = extractRoles({
			realm_access: { roles: 'not-an-array' },
			resource_access: { 'loom-app': { roles: [1, 2, 3] } }
		});

		expect(roles).toEqual([]);
	});
});

describe('hasAnyRole', () => {
	it('returns true when a required role is present', () => {
		expect(hasAnyRole(['founder'], ['founder', 'leader'])).toBe(true);
	});

	it('returns false when no required role is present', () => {
		expect(hasAnyRole(['member'], ['founder', 'leader'])).toBe(false);
	});

	it('returns false for undefined roles', () => {
		expect(hasAnyRole(undefined, ['founder'])).toBe(false);
	});

	it('returns false for empty roles', () => {
		expect(hasAnyRole([], ['founder'])).toBe(false);
	});
});

describe('requireRole', () => {
	it('does not throw when the role is present', () => {
		expect(() => requireRole({ roles: ['founder'] }, ['founder', 'leader'])).not.toThrow();
	});

	it('throws a 403 SvelteKit error when the role is missing', () => {
		try {
			requireRole({ roles: ['member'] }, ['founder', 'leader']);
			expect.unreachable('requireRole should have thrown');
		} catch (err) {
			expect(err).toMatchObject({ status: 403 });
		}
	});
});
