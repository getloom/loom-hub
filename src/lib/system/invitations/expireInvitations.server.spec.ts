import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import sinon from 'sinon';
import { startInvitationExpiryScheduler } from './expireInvitations.server';
import type { InvitationService } from './invitationsService.server';

describe('starting the invitation expiry scheduler', () => {
	let service: InvitationService;

	beforeEach(() => {
		vi.useFakeTimers();
		service = { expireOverdue: () => {} } as any as InvitationService;
		(globalThis as any).__invitationExpirySchedulerHandle = undefined;
	});

	afterEach(() => {
		const handle = (globalThis as any).__invitationExpirySchedulerHandle;
		if (handle) clearInterval(handle);
		(globalThis as any).__invitationExpirySchedulerHandle = undefined;
		vi.useRealTimers();
	});

	it('runs an immediate check on start', async () => {
		const stub = sinon.stub(service, 'expireOverdue').resolves({ ok: true, data: [], code: 200 });

		startInvitationExpiryScheduler(service, 60_000);
		await vi.advanceTimersByTimeAsync(0);

		expect(stub.callCount).toBe(1);
		sinon.assert.calledOnce(stub);
	});

	it('runs again after the interval elapses', async () => {
		const stub = sinon.stub(service, 'expireOverdue').resolves({ ok: true, data: [], code: 200 });

		startInvitationExpiryScheduler(service, 60_000);
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(60_000);

		expect(stub.callCount).toBe(2);
		sinon.assert.calledTwice(stub);
	});

	it('logs a failed tick without throwing', async () => {
		const stub = sinon
			.stub(service, 'expireOverdue')
			.resolves({ ok: false, error: 'Failed to expire overdue invitations', code: 500 });

		expect(() => startInvitationExpiryScheduler(service, 60_000)).not.toThrow();
		await vi.advanceTimersByTimeAsync(0);

		sinon.assert.calledOnce(stub);
	});

	it('clears a previously running interval instead of stacking a second one', async () => {
		const stub = sinon.stub(service, 'expireOverdue').resolves({ ok: true, data: [], code: 200 });

		startInvitationExpiryScheduler(service, 60_000);
		await vi.advanceTimersByTimeAsync(0);
		startInvitationExpiryScheduler(service, 60_000);
		await vi.advanceTimersByTimeAsync(0);
		stub.resetHistory();

		await vi.advanceTimersByTimeAsync(60_000);

		expect(stub.callCount).toBe(1);
		sinon.assert.calledOnce(stub);
	});
});
