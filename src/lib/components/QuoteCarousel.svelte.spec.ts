import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuoteCarousel from './QuoteCarousel.svelte';
import type { Post } from '$lib/system/posts/postsService';

function makeQuote(id: number, overrides: Partial<Post> = {}): Post {
	return {
		post_id: id,
		type: 'quote',
		title: `Author ${id}`,
		body: `Quote body ${id}`,
		link: null,
		image: null,
		active: true,
		created_by: 'user-sub',
		created_at: new Date(),
		updated_at: null,
		...overrides
	};
}

const quotes = [makeQuote(1), makeQuote(2), makeQuote(3)];

function renderCarousel(props: Partial<{ quotes: Post[]; isAdmin: boolean }> = {}) {
	const onedit = vi.fn();
	const ondelete = vi.fn();
	const screen = render(QuoteCarousel, { quotes, isAdmin: false, onedit, ondelete, ...props });
	return { screen, onedit, ondelete };
}

describe('QuoteCarousel', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders the first quote body and author', async () => {
		renderCarousel();

		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();
		await expect.element(page.getByText('Author 1')).toBeInTheDocument();
	});

	it('renders the author as an external link when link is set', async () => {
		renderCarousel({ quotes: [makeQuote(1, { link: 'https://example.com/ada' })] });

		const link = page.getByRole('link', { name: 'Author 1' });
		await expect.element(link).toHaveAttribute('href', 'https://example.com/ada');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('renders the author as plain text when there is no link', async () => {
		renderCarousel();

		await expect.element(page.getByText('Author 1')).toBeInTheDocument();
		expect(page.getByRole('link').elements()).toHaveLength(0);
	});

	it('advances every 8s and wraps back to the first quote', async () => {
		renderCarousel();

		vi.advanceTimersByTime(8000);
		await expect.element(page.getByText('Quote body 2')).toBeInTheDocument();
		vi.advanceTimersByTime(8000);
		await expect.element(page.getByText('Quote body 3')).toBeInTheDocument();
		vi.advanceTimersByTime(8000);
		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();
	});

	it('does not advance while hovered and resumes after leave', async () => {
		renderCarousel();
		const region = page.getByRole('region', { name: 'Quotes' });

		await region.hover();
		vi.advanceTimersByTime(20000);
		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();

		await userEvent.unhover(region);
		vi.advanceTimersByTime(8000);
		await expect.element(page.getByText('Quote body 2')).toBeInTheDocument();
	});

	it('shows no controls and does not advance with a single quote', async () => {
		renderCarousel({ quotes: [makeQuote(1)] });

		vi.advanceTimersByTime(20000);
		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();
		expect(page.getByRole('button').elements()).toHaveLength(0);
	});

	it('navigates with next and previous buttons', async () => {
		renderCarousel();

		await page.getByRole('button', { name: 'Next quote' }).click();
		await expect.element(page.getByText('Quote body 2')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Previous quote' }).click();
		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();

		await page.getByRole('button', { name: 'Previous quote' }).click();
		await expect.element(page.getByText('Quote body 3')).toBeInTheDocument();
	});

	it('shows admin buttons that call back with the current quote', async () => {
		const { onedit, ondelete } = renderCarousel({ isAdmin: true });

		await page.getByRole('button', { name: 'Edit post Author 1' }).click();
		expect(onedit).toHaveBeenCalledWith(quotes[0]);

		await page.getByRole('button', { name: 'Delete post Author 1' }).click();
		expect(ondelete).toHaveBeenCalledWith(quotes[0]);
	});

	it('hides admin buttons for non-admins', async () => {
		renderCarousel();

		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();
		expect(page.getByRole('button', { name: /^(Edit|Delete) post/ }).elements()).toHaveLength(0);
	});

	it('resets to the first quote when quotes shrink below the current index', async () => {
		const { screen } = renderCarousel();

		await page.getByRole('button', { name: 'Previous quote' }).click();
		await expect.element(page.getByText('Quote body 3')).toBeInTheDocument();

		await screen.rerender({ quotes: [quotes[0], quotes[1]] });
		await expect.element(page.getByText('Quote body 1')).toBeInTheDocument();
	});
});
