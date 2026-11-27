import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type {
	InvitationWithUsernames,
	Redemption
} from '$lib/system/invitations/invitationsService';

const invalidateAll = vi.fn();

vi.mock('$app/navigation', () => ({
	invalidateAll: () => invalidateAll()
}));

describe('/invitations/+page.svelte', () => {
	const invitation: InvitationWithUsernames = {
		invite_id: 1,
		invite_code: 'abc123',
		created_by: 'user-sub',
		status: 'pending',
		max_uses: 1,
		use_count: 0,
		limit_exempt: false,
		expires_at: new Date('2026-11-19'),
		created_at: new Date('2026-08-01'),
		updated_at: null,
		created_by_username: 'alice',
		redemptions: []
	};

	async function openCreateModal() {
		await page.getByRole('button', { name: 'Create', exact: true }).click();
	}

	beforeEach(() => {
		invalidateAll.mockReset();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('should render h1', async () => {
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('shows an empty state when there are no invitations', async () => {
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await expect.element(page.getByText('No invitations found.')).toBeInTheDocument();
	});

	it('renders a row for each invitation', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

		await expect.element(page.getByText('abc123')).toBeInTheDocument();
		await expect.element(page.getByText('pending')).toBeInTheDocument();
	});

	it('opens a create dialog instead of submitting when Create is clicked', async () => {
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Custom code (optional)')).toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('cancel closes the create dialog without creating', async () => {
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('keeps the create dialog open and shows the error when the code is taken', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify('Invite code is already taken'), { status: 409 })
		);

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Custom code (optional)').fill('welcome');
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect
			.element(page.getByRole('dialog').getByText('Invite code is already taken'))
			.toBeInTheDocument();
	});

	it('creates an invitation and refreshes the list on success', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/invitations',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('sends no invite code when the custom code field is blank', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string).invite_code).toBeUndefined();
	});

	it('sends the typed custom code', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Custom code (optional)').fill('welcome');
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string)).toEqual({ invite_code: 'welcome', max_uses: 1 });
	});

	it('creates a generated code when the custom code is typed and then cleared', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		const input = page.getByLabelText('Custom code (optional)');
		await input.fill('welcome');
		await input.fill('');
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string).invite_code).toBeUndefined();
		await expect.element(page.getByText('Failed to create invitation')).not.toBeInTheDocument();
	});

	it('shows the server message when the custom code is already taken', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify('Invite code is already taken'), { status: 409 })
		);

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Custom code (optional)').fill('welcome');
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.element(page.getByText('Invite code is already taken')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('shows an error and does not refresh when create fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Failed to create invitation' }), { status: 500 })
		);

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.element(page.getByText('Failed to create invitation')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	const redemption: Redemption = {
		redemption_id: 10,
		invite_id: 2,
		user_sub: 'keycloak-sub-1',
		username: 'bob',
		status: 'active',
		created_at: '2026-09-01T00:00:00.000Z',
		revoked_at: null
	};

	const acceptedInvitation: InvitationWithUsernames = {
		...invitation,
		invite_id: 2,
		invite_code: 'accepted1',
		status: 'accepted',
		use_count: 1,
		redemptions: [redemption]
	};

	it('shows the redeemer username instead of the raw sub when it is known', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [acceptedInvitation]
			}
		});

		await expect.element(page.getByText('bob')).toBeInTheDocument();
		await expect.element(page.getByText('keycloak-sub-1')).not.toBeInTheDocument();
	});

	it('falls back to the raw redeemer sub when no username is known', async () => {
		const withoutUsername: InvitationWithUsernames = {
			...acceptedInvitation,
			invite_id: 3,
			invite_code: 'accepted2',
			redemptions: [{ ...redemption, username: null }]
		};

		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [withoutUsername]
			}
		});

		await expect.element(page.getByText('keycloak-sub-1')).toBeInTheDocument();
	});

	it('renders the uses column as n / max, with an infinity sign for unlimited codes', async () => {
		const limited: InvitationWithUsernames = {
			...acceptedInvitation,
			invite_code: 'multi1',
			status: 'active',
			max_uses: 5,
			use_count: 2
		};
		const unlimitedInvitation: InvitationWithUsernames = {
			...limited,
			invite_id: 4,
			invite_code: 'unlim1',
			max_uses: null,
			use_count: 7
		};

		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [limited, unlimitedInvitation]
			}
		});

		await expect.element(page.getByText('2 / 5')).toBeInTheDocument();
		await expect.element(page.getByText('7 / ∞')).toBeInTheDocument();
	});

	it('lists every redeemer of a multi-use invitation', async () => {
		const multi: InvitationWithUsernames = {
			...acceptedInvitation,
			status: 'active',
			max_uses: 3,
			use_count: 2,
			redemptions: [
				redemption,
				{ ...redemption, redemption_id: 11, user_sub: 'keycloak-sub-2', username: 'carol' }
			]
		};

		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [multi] }
		});

		await expect.element(page.getByText('bob, carol')).toBeInTheDocument();
	});

	it('defaults max uses to 1 in the create dialog and posts it', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await expect.element(page.getByLabelText('Max uses')).toHaveValue(1);
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string).max_uses).toBe(1);
	});

	it('posts a custom max uses', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Max uses').fill('5');
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string).max_uses).toBe(5);
	});

	it('posts null max_uses when Unlimited is checked and disables the number field', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(invitation), { status: 201 }));
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Unlimited').click();
		await expect.element(page.getByLabelText('Max uses')).toBeDisabled();
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect.poll(() => invalidateAll).toHaveBeenCalledTimes(1);
		const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
		expect(JSON.parse(init.body as string).max_uses).toBeNull();
	});

	it.each(['0', '-3'])('blocks invalid max uses "%s" client-side', async (value) => {
		render(Page, {
			data: { isAuthenticated: true, title: 'Invitations', isAdmin: false, invitations: [] }
		});

		await openCreateModal();
		await page.getByLabelText('Max uses').fill(value);
		await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();

		await expect
			.element(page.getByText('Max uses must be a whole number of at least 1, or unlimited'))
			.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('delete button is disabled for an active invitation with redemptions', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [{ ...acceptedInvitation, status: 'active', max_uses: 3 }]
			}
		});

		await expect
			.element(page.getByRole('button', { name: 'Delete invitation accepted1' }))
			.toBeDisabled();
	});

	it('delete button is disabled for an expired invitation that was used', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [{ ...acceptedInvitation, status: 'expired' }]
			}
		});

		await expect
			.element(page.getByRole('button', { name: 'Delete invitation accepted1' }))
			.toBeDisabled();
	});

	it('delete button is disabled for accepted/revoked invitations', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [acceptedInvitation]
			}
		});

		const deleteButton = page.getByRole('button', { name: 'Delete invitation accepted1' });
		await expect.element(deleteButton).toBeDisabled();
	});

	it('delete button is enabled for pending/expired invitations', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

		const deleteButton = page.getByRole('button', { name: 'Delete invitation abc123' });
		await expect.element(deleteButton).not.toBeDisabled();
	});

	it('opens a confirmation dialog when the delete button is clicked', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();

		await expect.element(page.getByRole('dialog')).toBeInTheDocument();
		await expect.element(page.getByText('Delete invitation')).toBeInTheDocument();
	});

	it('confirm delete button is disabled until DELETE is typed', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

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

		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

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

		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();
		await page.getByLabelText('Confirmation').fill('DELETE');
		await page.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect
			.element(page.getByText('Invitation cannot be deleted in its current status'))
			.toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('cancel closes the dialog without deleting', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				title: 'Invitations',
				isAdmin: false,
				invitations: [invitation]
			}
		});

		await page.getByRole('button', { name: 'Delete invitation abc123' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(fetch).not.toHaveBeenCalled();
	});
});
