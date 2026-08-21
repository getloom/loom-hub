<script lang="ts">
	import { Button } from 'svelte-ux';
</script>

<div class="mx-auto max-w-md p-6">
	<h1 class="mb-6 text-2xl font-bold">Sign In</h1>

	<Button href="/auth/keycloak/login" variant="fill" color="primary">Sign in with SSO</Button>
</div>
