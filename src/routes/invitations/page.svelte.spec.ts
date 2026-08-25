import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Invitation } from '$lib/system/invitations/invitationsService';

const invalidateAll = vi.fn();

vi.mock('$app/navigation', () => ({
	invalidateAll: () => invalidateAll()
}));

describe('/invitations/+page.svelte', () => {
	const invitation: Invitation = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		used_by: null,
		status: 'pending',
		expires_at: new Date('2026-11-19'),
		created_at: new Date('2026-08-01'),
		updated_at: null
	};

	beforeEach(() => {
		invalidateAll.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('should render h1', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [] } });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('shows an empty state when there are no invitations', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [] } });

		await expect.element(page.getByText('No invitations found.')).toBeInTheDocument();
	});

	it('renders a row for each invitation', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await expect.element(page.getByText('abc123')).toBeInTheDocument();
		await expect.element(page.getByText('pending')).toBeInTheDocument();
	});

	it('creates an invitation and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));

		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [] } });

		await page.getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/invitations',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('shows an error and does not refresh when create fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to create invitation' }), { status: 500 })
		);

		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [] } });

		await page.getByRole('button', { name: 'Create' }).click();

		await expect.element(page.getByText('Failed to create invitation')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	const acceptedInvitation: Invitation = {
		...invitation,
		invite_id: 2,
		invite_code: 'accepted1',
		status: 'accepted'
	};

	it('delete button is disabled for accepted/revoked invitations', async () => {
		render(Page, {
			data: { isAuthenticated: true, isAdmin: false, invitations: [acceptedInvitation] }
		});

		const deleteButton = page.getByRole('button', { name: 'Delete invitation accepted1' });
		await expect.element(deleteButton).toBeDisabled();
	});

	it('delete button is enabled for pending/expired invitations', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		const deleteButton = page.getByRole('button', { name: 'Delete invitation abc123' });
		await expect.element(deleteButton).not.toBeDisabled();
	});

	it('opens a confirmation dialog when the delete button is clicked', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Delete invitation')).toBeInTheDocument();
	});

	it('confirm delete button is disabled until DELETE is typed', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();

		const confirmButton = page.getByRole('button', { name: 'Delete', exact: true });
		await expect.element(confirmButton).toBeDisabled();

		const confirmInput = page.getByLabelText('Confirmation');
		await confirmInput.fill('nope');
		await expect.element(confirmButton).toBeDisabled();

		await confirmInput.fill('DELETE');
		await expect.element(confirmButton).not.toBeDisabled();
	});

	it('deletes an invitation and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');
		await page.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/invitations/1',
			expect.objectContaining({ method: 'DELETE' })
		);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows an error and does not refresh when delete fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({ error: 'Invitation cannot be deleted in its current status' }),
				{
					status: 409
				}
			)
		);

		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');
		await page.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect
			.element(page.getByText('Invitation cannot be deleted in its current status'))
			.toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('cancel closes the dialog without deleting', async () => {
		render(Page, { data: { isAuthenticated: true, isAdmin: false, invitations: [invitation] } });

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});
});
