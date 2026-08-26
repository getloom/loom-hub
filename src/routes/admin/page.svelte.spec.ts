import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Invitation } from '$lib/system/invitations/invitationsService';

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
		render(Page, { data: { isAuthenticated: true, isAdmin: true, invitations: [] } });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('shows an empty state when there are no invitations', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: true, invitations: [] } });

		await expect.element(page.getByText('No invitations found.')).toBeInTheDocument();
	});

	it('renders a row for each invitation', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
		});

		await expect.element(page.getByText('abc123')).toBeInTheDocument();
		await expect.element(page.getByText('accepted')).toBeInTheDocument();
	});

	it('revoke button is enabled for accepted invitations', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
		});

		const revokeButton = page.getByRole('button', { name: 'Revoke invitation abc123' });
		await expect.element(revokeButton).not.toBeDisabled();
	});

	it('revoke button is disabled for pending/expired/revoked invitations', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [pendingInvitation] }
		});

		const revokeButton = page.getByRole('button', { name: 'Revoke invitation pending1' });
		await expect.element(revokeButton).toBeDisabled();
	});

	it('opens a confirmation dialog when the revoke button is clicked', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Revoke invitation')).toBeInTheDocument();
	});

	it('confirm revoke button is disabled until REVOKE is typed', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
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
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
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
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('REVOKE');
		await page.getByRole('button', { name: 'Revoke', exact: true }).click();

		await expect.element(page.getByText('Failed to deactivate user')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('cancel closes the dialog without revoking', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: true, invitations: [acceptedInvitation] }
		});

		await page.getByRole('button', { name: 'Revoke invitation abc123' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});
});
