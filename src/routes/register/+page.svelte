<script lang="ts">
	import { Button, TextField } from 'svelte-ux';
	import { page } from '$app/state';

	let inviteCodeFromUrl = page.url.searchParams.get('invite_code') ?? '';

	let submitting = $state(false);
	let error = $state<string | null>(null);

	let username = $state('');
	let password = $state('');
	let confirmation = $state('');
	let inviteCode = $state(inviteCodeFromUrl);

	async function handleRegister() {
		submitting = true;
		error = null;

		try {
			const response = await fetch('/api/registration', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username,
					password,
					confirmation,
					invite_code: inviteCode
				})
			});

			if (!response.ok) {
				const result = await response.json();
				error = result.error ?? 'Failed to register';
				return;
			}

			window.location.href = '/';
		} catch {
			error = 'Failed to register';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center p-6">
	<div class="w-full max-w-md">
		<h1 class="mb-6 text-center text-2xl font-bold">Register</h1>

		<div class="flex flex-col gap-4">
			{#if error}
				<p class="text-red-600">{error}</p>
			{/if}
			<TextField label="Username" bind:value={username} autofocus />
			<TextField label="Password" type="password" bind:value={password} />
			<TextField label="Confirm password" type="password" bind:value={confirmation} />
			<TextField label="Invite code" bind:value={inviteCode} />
		</div>

		<div class="mt-6 flex items-center justify-between gap-2">
			<Button href="/signin">Back to sign in</Button>
			<Button
				variant="fill"
				color="primary"
				disabled={!username || !password || !confirmation || !inviteCode || submitting}
				onclick={handleRegister}
			>
				{submitting ? 'Registering...' : 'Register'}
			</Button>
		</div>
	</div>
</div>
