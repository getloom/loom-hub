import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/signin/+page.svelte', () => {
	it('renders the SSO sign-in link and the register link', async () => {
		render(Page);

		await expect.element(page.getByRole('link', { name: 'Sign in with SSO' })).toBeInTheDocument();
		const registerLink = page.getByRole('link', { name: 'Register with code' });
		await expect.element(registerLink).toBeInTheDocument();
		await expect.element(registerLink).toHaveAttribute('href', '/register');
	});
});
