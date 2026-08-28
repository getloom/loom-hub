import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Invitation } from '$lib/system/invitations/invitationsService';
import type { Setting } from '$lib/system/settings/settingsService';

const invalidateAll = vi.fn();

vi.mock('$app/navigation', () => ({
	invalidateAll: () => invalidateAll()
}));

describe('/admin/+page.svelte', () => {
	const acceptedInvitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: 'keycloak-sub-1',
		status: 'accepted',
		expires_at: new Date('2026-11-19'),
		created_at: new Date('2026-08-01'),
		updated_at: null
	};

	const pendingInvitation: Invitation = {
		...acceptedInvitation,
		invite_id: 2,
		invite_code: 'pending1',
		used_by: null,
		status: 'pending'
	};

	beforeEach(() => {
		invalidateAll.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('should render h1', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [] } });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('shows an empty state when there are no invitations', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [] } });

		await expect.element(page.getByText('No invitations found.')).toBeInTheDocument();
	});

	it('renders a row for each invitation', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await expect.element(page.getByText('abc123')).toBeInTheDocument();
		await expect.element(page.getByText('accepted')).toBeInTheDocument();
	});

	it('revoke button is enabled for accepted invitations', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		const revokeButton = page.getByRole('button', { name: 'Revoke invitation abc123' });
		await expect.element(revokeButton).not.toBeDisabled();
	});

	it('revoke button is disabled for pending/expired/revoked invitations', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [pendingInvitation], settings: [] }
		});

		const revokeButton = page.getByRole('button', { name: 'Revoke invitation pending1' });
		await expect.element(revokeButton).toBeDisabled();
	});

	it('opens a confirmation dialog when the revoke button is clicked', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Revoke invitation')).toBeInTheDocument();
	});

	it('confirm revoke button is disabled until REVOKE is typed', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();

		const confirmButton = page.getByRole('button', { name: 'Revoke', exact: true });
		await expect.element(confirmButton).toBeDisabled();

		const confirmInput = page.getByLabelText('Confirmation');
		await confirmInput.fill('nope');
		await expect.element(confirmButton).toBeDisabled();

		await confirmInput.fill('REVOKE');
		await expect.element(confirmButton).not.toBeDisabled();
	});

	it('revokes an invitation and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ ...acceptedInvitation, status: 'revoked' }), { status: 200 })
		);

		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('REVOKE');
		await page.getByRole('button', { name: 'Revoke', exact: true }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/admin/invitations/1/revoke',
			expect.objectContaining({ method: 'POST' })
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and does not refresh when revoke fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to deactivate user' }), { status: 500 })
		);

		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('REVOKE');
		await page.getByRole('button', { name: 'Revoke', exact: true }).click();

		await expect.element(page.getByText('Failed to deactivate user')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('cancel closes the dialog without revoking', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [acceptedInvitation],
				settings: []
			}
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('/admin/+page.svelte settings section', () => {
	const limitSetting: Setting = {
		key: 'invite_count_limit',
		value: '2',
		created_at: new Date('2026-08-01'),
		updated_at: null
	};

	const cycleSetting: Setting = {
		key: 'invite_count_cycle',
		value: 'year',
		created_at: new Date('2026-08-01'),
		updated_at: null
	};

	const unknownSetting: Setting = {
		key: 'some_future_setting',
		value: 'raw-value',
		created_at: new Date('2026-08-01'),
		updated_at: null
	};

	beforeEach(() => {
		invalidateAll.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('renders settings sorted by key regardless of the order returned by the API', async () => {
		const { container } = render(Page, {
			data: {
				isAuthenticated: true,
				isAdmin: true,
				invitations: [],
				settings: [unknownSetting, limitSetting, cycleSetting]
			}
		});

		const text = container.textContent ?? '';
		const cycleIndex = text.indexOf('Invite Count Cycle');
		const limitIndex = text.indexOf('Invite Count Limit');
		const unknownIndex = text.indexOf('some_future_setting');

		expect(cycleIndex).toBeGreaterThan(-1);
		expect(limitIndex).toBeGreaterThan(cycleIndex);
		expect(unknownIndex).toBeGreaterThan(limitIndex);
	});

	it('renders invite_count_limit as a labeled number input pre-filled with the loaded value', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [limitSetting] }
		});

		await expect.element(page.getByLabelText('Invite Count Limit')).toHaveValue(2);
	});

	it('renders invite_count_cycle as a SelectField with Year/Month/Lifetime options, current value selected', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [cycleSetting] }
		});

		const select = page.getByLabelText('Invite Count Cycle');
		await expect.element(select).toHaveValue('Year');

		await select.click();
		await expect.element(page.getByRole('option', { name: 'Year' })).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: 'Month' })).toBeInTheDocument();
		await expect.element(page.getByRole('option', { name: 'Lifetime' })).toBeInTheDocument();
	});

	it('renders an unrecognized setting key as a generic labeled text field', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [unknownSetting] }
		});

		await expect.element(page.getByLabelText('some_future_setting')).toHaveValue('raw-value');
	});

	it('save button is disabled until dirty, and re-disabled when reverted to the original value', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [limitSetting] }
		});

		const input = page.getByLabelText('Invite Count Limit');
		const saveButton = page.getByRole('button', { name: 'Save', exact: true });

		await expect.element(saveButton).toBeDisabled();

		await input.fill('5');
		await expect.element(saveButton).not.toBeDisabled();

		await input.fill('2');
		await expect.element(saveButton).toBeDisabled();
	});

	it('an invalid invite_count_limit value disables Save and shows the validation message', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [limitSetting] }
		});

		const input = page.getByLabelText('Invite Count Limit');
		const saveButton = page.getByRole('button', { name: 'Save', exact: true });

		await input.fill('-2');
		await expect.element(saveButton).toBeDisabled();
		await expect
			.element(page.getByText('Must be -1 (unlimited) or a non-negative integer'))
			.toBeInTheDocument();
	});

	it('saves a setting via PUT and refreshes on success', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ ...limitSetting, value: '5' }), { status: 200 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [limitSetting] }
		});

		const input = page.getByLabelText('Invite Count Limit');
		await input.fill('5');

		await page.getByRole('button', { name: 'Save', exact: true }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/admin/settings/invite_count_limit',
			expect.objectContaining({
				method: 'PUT',
				body: JSON.stringify({ value: '5' })
			})
		);
	});

	it('shows an inline error and does not refresh when a save fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to save setting' }), { status: 500 })
		);

		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [], settings: [limitSetting] }
		});

		const input = page.getByLabelText('Invite Count Limit');
		await input.fill('5');
		await page.getByRole('button', { name: 'Save', exact: true }).click();

		await expect.element(page.getByText('Failed to save setting')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});
