import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { Invitation } from '$lib/system/invitations/invitationsService';

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

	it('should render h1', async () => {
		render(Page, { data: { isAuthenticated: true, invitations: [] } });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});

	it('shows an empty state when there are no invitations', async () => {
		render(Page, { data: { isAuthenticated: true, invitations: [] } });

		await expect.element(page.getByText('No invitations found.')).toBeInTheDocument();
	});

	it('renders a row for each invitation', async () => {
		render(Page, { data: { isAuthenticated: true, invitations: [invitation] } });

		await expect.element(page.getByText('abc123')).toBeInTheDocument();
		await expect.element(page.getByText('pending')).toBeInTheDocument();
	});
});
