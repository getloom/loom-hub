import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const state = vi.hoisted(() => ({ url: new URL('http://localhost/register') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return state.url;
		}
	}
}));

describe('/register/+page.svelte', () => {
	beforeEach(() => {
		state.url = new URL('http://localhost/register');
		vi.stubGlobal('fetch', vi.fn());
	});

	it('renders the registration form fields', async () => {
		render(Page);

		await expect.element(page.getByLabelText('Username')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Password', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Confirm password')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Invite code')).toBeInTheDocument();
	});

	it('submit button stays disabled until all fields are filled', async () => {
		render(Page);

		const submitButton = page.getByRole('button', { name: 'Register', exact: true });
		await expect.element(submitButton).toBeDisabled();

		await page.getByLabelText('Username').fill('alice');
		await expect.element(submitButton).toBeDisabled();

		await page.getByLabelText('Password', { exact: true }).fill('password123');
		await expect.element(submitButton).toBeDisabled();

		await page.getByLabelText('Confirm password').fill('password123');
		await expect.element(submitButton).toBeDisabled();

		await page.getByLabelText('Invite code').fill('abc123');
		await expect.element(submitButton).not.toBeDisabled();
	});

	it('submits registration details to the API', async () => {
		// The fetch promise is deliberately left unresolved so that the component's
		// success path (`window.location.href = '/'`) never runs — a real browser's
		// Location object cannot be stubbed, and letting it fire would navigate the
		// test iframe away and break the rest of the suite.
		vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

		render(Page);

		await page.getByLabelText('Username').fill('alice');
		await page.getByLabelText('Password', { exact: true }).fill('password123');
		await page.getByLabelText('Confirm password').fill('password123');
		await page.getByLabelText('Invite code').fill('abc123');
		await page.getByRole('button', { name: 'Register', exact: true }).click();

		await expect.poll(() => vi.mocked(fetch).mock.calls.length).toBe(1);
		expect(fetch).toHaveBeenCalledWith(
			'/api/registration',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					username: 'alice',
					password: 'password123',
					confirmation: 'password123',
					invite_code: 'abc123'
				})
			})
		);
	});

	it('shows an error and does not navigate when registration fails', async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: 'Username is already taken' }), { status: 409 })
		);

		render(Page);

		await page.getByLabelText('Username').fill('alice');
		await page.getByLabelText('Password', { exact: true }).fill('password123');
		await page.getByLabelText('Confirm password').fill('password123');
		await page.getByLabelText('Invite code').fill('abc123');
		await page.getByRole('button', { name: 'Register', exact: true }).click();

		await expect.element(page.getByText('Username is already taken')).toBeInTheDocument();
	});

	it('pre-fills the invite code field when invite_code is present in the URL', async () => {
		state.url = new URL('http://localhost/register?invite_code=xyz789');

		render(Page);

		await expect.element(page.getByLabelText('Invite code')).toHaveValue('xyz789');
	});

	it('has a link back to sign in', async () => {
		render(Page);

		await expect.element(page.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
	});
});
