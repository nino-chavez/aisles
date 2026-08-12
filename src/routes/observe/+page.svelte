<script lang="ts">
	import type { SignalEvent, PersonaInference, SignalSource } from '$lib/signals/types';

	// ─── Types ─────────────────────────────────────────────────────
	interface GenerationLog {
		type: string;
		persona: string;
		categorySlug: string;
		cacheHit: boolean;
		generationMs: number;
		productCount: number | null;
		inputTokens: number | null;
		outputTokens: number | null;
		evalScore: number | null;
		promptVersion: string;
		model: string | null;
		estimatedCost: number | null;
		createdAt: string;
		synthetic?: boolean;
		scenarioId?: string | null;
	}

	interface EnrichedProductRow {
		id: string;
		entityId: number;
		name: string;
		price: number;
		salePrice?: number;
		personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
		semanticTags: string[];
		compatibleWith: string[];
		priceTier: string | null;
		petProfile: {
			protein: string; lifeStage: string; format: string; dietary: string; petSize: string;
			replenishmentDays: number | null; subscriptionFit: number;
		} | null;
	}

	interface IncentiveSnapshot {
		appliedCodes: string[];
		codes: Array<{ type: string; code: string }>;
		discounts: Array<{ title: string; target: string; amount: number; code?: string }>;
		wallet: {
			unit: string;
			balanceActive: number;
			tierCurrent: string | null;
			tierNext: string | null;
			unitsToNext: number | null;
		} | null;
		programName: string | null;
	}

	interface SessionData {
		sessionId: string;
		events: SignalEvent[];
		inference: PersonaInference;
		eventCount: number;
		crossSession: {
			scenarioId?: string | null;
			storedPersona: string | null;
			storedCategory: string | null;
			visitCount: number;
			currentCategory: string;
		};
		incentives: IncentiveSnapshot | null;
		scenarioLabel?: string | null;
	}

	// ─── State ─────────────────────────────────────────────────────
	const POLL_INTERVAL = 2000;

	let sessions = $state<Array<{ id: string; scenarioId: string | null; scenarioLabel: string | null }>>([]);
	let selectedSessionId = $state<string | null>(null);
	let sessionData = $state<SessionData | null>(null);
	let logs = $state<GenerationLog[]>([]);
	let watchLatest = $state(true);
	let enrichmentOpen = $state(false);
	let enrichmentProducts = $state<EnrichedProductRow[]>([]);
	let enrichmentCategory = $state<string | null>(null);
	let enrichmentLoading = $state(false);
	let previousEventCount = $state(0);
	let shiftFlash = $state(false);
	// ─── Source color mapping ──────────────────────────────────────
	const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
		request: { bg: 'bg-slate-700', text: 'text-slate-300', label: 'REQ' },
		navigation: { bg: 'bg-blue-700', text: 'text-blue-300', label: 'NAV' },
		interaction: { bg: 'bg-amber-700', text: 'text-amber-300', label: 'INT' },
		commerce: { bg: 'bg-emerald-700', text: 'text-emerald-300', label: 'COM' },
		refinement: { bg: 'bg-purple-700', text: 'text-purple-300', label: 'REF' },
		external: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'EXT' },
	};

	// ─── Persona colors ───────────────────────────────────────────
	const PERSONA_COLORS: Record<string, string> = {
		gatherer: 'bg-teal-500',
		hunter: 'bg-orange-500',
		researcher: 'bg-blue-500',
		gifter: 'bg-pink-500',
	};

	const PERSONA_TEXT_COLORS: Record<string, string> = {
		gatherer: 'text-teal-400',
		hunter: 'text-orange-400',
		researcher: 'text-blue-400',
		gifter: 'text-pink-400',
	};

	// ─── Polling ───────────────────────────────────────────────────
	$effect(() => {
		const fetchSessions = async () => {
			try {
				const res = await fetch('/api/observe/sessions');
				const data = await res.json();
				sessions = data.sessions || [];

				if (watchLatest && sessions.length > 0) {
					selectedSessionId = sessions[0].id;
				}
			} catch { /* ignore */ }
		};

		fetchSessions();
		const interval = setInterval(fetchSessions, POLL_INTERVAL);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!selectedSessionId) return;

		// Immediate fetch + poll
		const doFetch = async () => {
			try {
				const [sessionRes, logsRes] = await Promise.all([
					fetch(`/api/observe/session?id=${selectedSessionId}`),
					fetch(`/api/observe/logs?limit=50&session=${selectedSessionId}`),
				]);
				const newSession = await sessionRes.json();
				const newLogs = await logsRes.json();

				if (newSession.events) {
					// Detect shift flash
					if (
						newSession.inference?.shift?.detected &&
						sessionData?.inference?.shift?.detected !== true
					) {
						shiftFlash = true;
						setTimeout(() => (shiftFlash = false), 2000);
					}
					previousEventCount = sessionData?.eventCount ?? 0;
					sessionData = newSession;
				}
				logs = newLogs.logs || [];
			} catch { /* ignore */ }
		};

		doFetch();
		const interval = setInterval(doFetch, POLL_INTERVAL);
		return () => clearInterval(interval);
	});

	// ─── Enrichment fetch (on-demand when panel is opened) ───────
	$effect(() => {
		if (!enrichmentOpen || !sessionData?.crossSession?.currentCategory) return;
		const category = sessionData.crossSession.currentCategory;
		const persona = sessionData.inference?.primary || 'gatherer';

		if (category === enrichmentCategory) return;
		enrichmentProducts = [];

		enrichmentLoading = true;
		enrichmentCategory = category;

		fetch(`/api/observe/enrichment?category=${category}&persona=${persona}`)
			.then((r) => r.json())
			.then((data) => {
				enrichmentProducts = data.products || [];
			})
			.catch(() => { enrichmentProducts = []; })
			.finally(() => { enrichmentLoading = false; });
	});

	// ─── Derived ──────────────────────────────────────────────────
	let sortedEvents = $derived(
		sessionData?.events ? [...sessionData.events].reverse() : []
	);

	let newEventIds = $derived(
		sessionData?.events
			? new Set(sessionData.events.slice(previousEventCount).map((e) => e.id))
			: new Set<string>()
	);

	let latestLog = $derived(logs.find((l) => !l.cacheHit) ?? logs[0] ?? null);

	let cumulativeStats = $derived.by(() => {
		if (logs.length === 0) return { count: 0, cacheHitRate: 0, avgMs: 0, totalTokens: 0, totalCost: 0, sonnetFallbacks: 0 };
		const count = logs.length;
		const cacheHits = logs.filter((l) => l.cacheHit).length;
		const totalMs = logs.reduce((sum, l) => sum + l.generationMs, 0);
		const totalTokens = logs.reduce(
			(sum, l) => sum + (l.inputTokens ?? 0) + (l.outputTokens ?? 0),
			0
		);
		const totalCost = logs.reduce((sum, l) => sum + (l.estimatedCost ?? 0), 0);
		const sonnetFallbacks = logs.filter((l) => l.model?.includes('sonnet')).length;
		return {
			count,
			cacheHitRate: Math.round((cacheHits / count) * 100),
			avgMs: Math.round(totalMs / count),
			totalTokens,
			totalCost,
			sonnetFallbacks,
		};
	});

	// ─── Helpers ──────────────────────────────────────────────────
	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	}

	function formatPercent(n: number): string {
		return `${Math.round(n * 100)}%`;
	}

	function truncateId(id: string): string {
		return id.length > 12 ? id.slice(0, 8) + '...' + id.slice(-4) : id;
	}

</script>

<svelte:head>
	<title>Observe — Aisles Telemetry</title>
</svelte:head>

<style>
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	:global(.animate-slide-in) {
		animation: slide-in 0.3s ease-out;
	}
</style>

	<div class="min-h-screen bg-neutral-950 font-sans text-[13px] text-neutral-200 antialiased">
		<!-- ─── Top Bar: Session Picker ───────────────────────────── -->
		<header class="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
			<div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
				<div class="flex items-center gap-2">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">Observe</span>
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
				</div>

				<select
					bind:value={selectedSessionId}
					class="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 font-mono text-[11px] text-neutral-300 outline-none focus:border-neutral-500"
				>
					<option value={null}>Select session...</option>
					{#each sessions as session}
						<option value={session.id}>{session.scenarioLabel ? `SYNTHETIC · ${session.scenarioLabel}` : truncateId(session.id)}</option>
					{/each}
				</select>

				<label class="flex items-center gap-2 text-[12px] text-neutral-400">
					<input
						type="checkbox"
						bind:checked={watchLatest}
						class="rounded border-neutral-700 bg-neutral-800"
					/>
					Watch latest
				</label>

				{#if sessionData?.crossSession}
					{#if sessionData.crossSession.scenarioId}
						<span class="rounded bg-amber-950 px-2 py-1 font-mono text-[10px] font-semibold tracking-wide text-amber-300">SYNTHETIC SCENARIO · {sessionData.scenarioLabel ?? sessionData.crossSession.scenarioId}</span>
					{/if}
					<div class="ml-auto flex items-center gap-5 text-[12px]">
						<div class="flex items-baseline gap-1.5">
							<span class="text-neutral-500">visits</span>
							<span class="font-mono tabular-nums text-neutral-200">{sessionData.crossSession.visitCount}</span>
						</div>
						{#if sessionData.crossSession.storedPersona}
							<div class="flex items-baseline gap-1.5">
								<span class="text-neutral-500">stored</span>
								<span class="{PERSONA_TEXT_COLORS[sessionData.crossSession.storedPersona]} font-medium">{sessionData.crossSession.storedPersona}</span>
							</div>
						{/if}
						{#if sessionData.crossSession.currentCategory}
							<div class="flex items-baseline gap-1.5">
								<span class="text-neutral-500">category</span>
								<span class="text-neutral-200">{sessionData.crossSession.currentCategory}</span>
							</div>
						{/if}
						<div class="flex items-baseline gap-1.5">
							<span class="text-neutral-500">events</span>
							<span class="font-mono tabular-nums text-neutral-200">{sessionData.eventCount}</span>
						</div>
					</div>
				{/if}
			</div>
		</header>

		{#if !selectedSessionId || !sessionData}
			<div class="flex h-[calc(100vh-56px)] items-center justify-center">
				<p class="text-[13px] text-neutral-500">
					{sessions.length === 0 ? 'No active sessions. Browse the storefront to create one.' : 'Select a session to observe.'}
				</p>
			</div>
		{:else}
			<!-- ─── Persona Strip (session-level summary) ────────── -->
			{#if sessionData.inference}
				{@const inf = sessionData.inference}
				<section class="border-b border-neutral-800 bg-neutral-900/40 px-5 py-4">
					<div class="flex flex-wrap items-start gap-x-8 gap-y-4">
						<!-- Persona bars -->
						<div class="flex min-w-0 flex-1 flex-col gap-1.5" style="min-width: 360px;">
							<div class="mb-0.5 flex items-baseline justify-between">
								<span class="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">Persona</span>
								<span class="text-[11px] text-neutral-500">
									confidence gap
									<span class="ml-1 font-mono tabular-nums text-neutral-300">{formatPercent(inf.confidence)}</span>
								</span>
							</div>
							{#each ['gatherer', 'hunter', 'researcher', 'gifter'] as persona}
								{@const prob = inf.probabilities[persona as keyof typeof inf.probabilities]}
								{@const isPrimary = inf.primary === persona}
								<div class="flex items-center gap-3">
									<span class="w-20 text-[12px] {isPrimary ? PERSONA_TEXT_COLORS[persona] + ' font-semibold' : 'text-neutral-400'}">
										{persona}
									</span>
									<div class="relative h-[6px] flex-1 overflow-hidden rounded-full bg-neutral-800">
										<div
											class="h-full rounded-full transition-all duration-700 ease-out {PERSONA_COLORS[persona]}"
											style="width: {prob * 100}%"
										></div>
									</div>
									<span class="w-10 text-right font-mono text-[11px] tabular-nums {isPrimary ? 'text-neutral-200' : 'text-neutral-500'}">
										{formatPercent(prob)}
									</span>
								</div>
							{/each}
						</div>

						<!-- Modifiers -->
						<div class="flex flex-col gap-1.5" style="min-width: 220px;">
							<span class="mb-0.5 text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">Modifiers</span>
							{#each [
								['price sensitivity', inf.modifiers.priceSensitivity],
								['urgency', inf.modifiers.urgency],
								['familiarity', inf.modifiers.familiarityWithStore],
							] as [label, value]}
								<div class="flex items-center gap-3">
									<span class="w-28 text-[11px] text-neutral-400">{label}</span>
									<div class="relative h-[4px] flex-1 overflow-hidden rounded-full bg-neutral-800">
										<div
											class="h-full rounded-full bg-neutral-400 transition-all duration-700"
											style="width: {(value as number) * 100}%"
										></div>
									</div>
									<span class="w-8 text-right font-mono text-[10px] tabular-nums text-neutral-500">
										{formatPercent(value as number)}
									</span>
								</div>
							{/each}
						</div>

						<!-- Shift detection -->
						{#if inf.shift.detected}
							<div
								class="flex flex-col justify-center rounded-md border px-3 py-2 text-[11px] transition-colors duration-300"
								class:border-amber-600={shiftFlash}
								class:bg-amber-950={shiftFlash}
								class:text-amber-300={shiftFlash}
								class:border-neutral-700={!shiftFlash}
								class:text-neutral-400={!shiftFlash}
								style="min-width: 180px;"
							>
								<div class="text-[10px] font-semibold tracking-[0.14em] uppercase">Shift Detected</div>
								<div class="mt-1">
									<span class={PERSONA_TEXT_COLORS[inf.shift.from ?? ''] ?? 'text-neutral-500'}>{inf.shift.from}</span>
									<span class="text-neutral-500"> → </span>
									<span class="{PERSONA_TEXT_COLORS[inf.primary]} font-semibold">{inf.primary}</span>
								</div>
								{#if inf.shift.trigger}
									<div class="mt-0.5 text-[10px] text-neutral-500">{inf.shift.trigger}</div>
								{/if}
							</div>
						{/if}
					</div>
				</section>
			{/if}

			<!-- ─── Dashboard Grid ───────────────────────────────── -->
			<div class="grid h-[calc(100vh-var(--observe-chrome))] grid-cols-[minmax(0,1fr)_400px] gap-px overflow-hidden bg-neutral-800" style="--observe-chrome: 260px;">
				<!-- ─── Left: Signal Timeline ─────────────────────── -->
				<div class="flex min-w-0 flex-col bg-neutral-950">
					<div class="flex items-baseline justify-between border-b border-neutral-800 px-5 py-3">
						<h2 class="text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">Signal Timeline</h2>
						<span class="text-[11px] text-neutral-600">{sortedEvents.length} events</span>
					</div>
					<div class="flex-1 overflow-y-auto px-3 py-2" id="signal-timeline">
						{#each sortedEvents as event (event.id)}
							{@const sourceStyle = SOURCE_COLORS[event.source] || SOURCE_COLORS.external}
							{@const isNew = newEventIds.has(event.id)}
							<div
								class="group mb-0.5 flex min-w-0 items-center gap-3 rounded px-2 py-[5px] text-[12px] transition-all duration-500 hover:bg-neutral-900"
								class:bg-neutral-900={isNew}
								class:animate-slide-in={isNew}
							>
								<span class="w-[58px] shrink-0 font-mono text-[11px] tabular-nums text-neutral-600">
									{formatTime(event.timestamp)}
								</span>
								<span
									class="w-9 shrink-0 rounded px-1.5 py-0.5 text-center text-[9px] font-semibold tracking-wider uppercase {sourceStyle.bg} {sourceStyle.text}"
								>
									{sourceStyle.label}
								</span>
								<span class="w-[160px] shrink-0 truncate font-mono text-[11px] text-neutral-300">{event.type}</span>
								{#if Object.keys(event.data).length > 0}
									<span class="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-600">
										{JSON.stringify(event.data)}
									</span>
								{/if}
							</div>
						{/each}

						{#if sortedEvents.length === 0}
							<p class="py-10 text-center text-[12px] text-neutral-600">Waiting for signals...</p>
						{/if}
					</div>
				</div>

				<!-- ─── Right Panels ──────────────────────────────── -->
				<div class="flex min-w-0 flex-col gap-px overflow-y-auto bg-neutral-800">
					<!-- ─── Rules Fired ────────────────────────────── -->
					<div class="bg-neutral-950 p-5">
						<div class="mb-3 flex items-baseline justify-between">
							<h2 class="text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">Rules Fired</h2>
							{#if sessionData.inference?.ruleMatches?.length}
								<span class="text-[11px] text-neutral-600">{sessionData.inference.ruleMatches.length}</span>
							{/if}
						</div>

						{#if sessionData.inference?.ruleMatches?.length > 0}
							<div class="space-y-2">
								{#each sessionData.inference.ruleMatches as match}
									<div class="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
										<div class="flex items-baseline justify-between gap-2">
											<span class="truncate text-[12px] font-medium text-neutral-200">{match.ruleName}</span>
											<span class="shrink-0 font-mono text-[10px] text-neutral-500">w {match.weight.toFixed(1)}</span>
										</div>
										<div class="mt-1 text-[11px] leading-snug text-neutral-500">{match.reason}</div>
										<div class="mt-1.5 flex flex-wrap gap-1">
											{#each ['gatherer', 'hunter', 'researcher', 'gifter'] as p}
												{#if (match.adjustment as any)[p]}
													<span class="rounded px-1.5 py-0.5 font-mono text-[10px] {PERSONA_TEXT_COLORS[p]} bg-neutral-800/80">
														{p[0]}+{((match.adjustment as any)[p] * match.weight).toFixed(2)}
													</span>
												{/if}
											{/each}
											{#if match.adjustment.priceSensitivity}
												<span class="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">price+{(match.adjustment.priceSensitivity * match.weight).toFixed(2)}</span>
											{/if}
											{#if match.adjustment.familiarityWithStore}
												<span class="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[10px] text-blue-400">fam+{(match.adjustment.familiarityWithStore * match.weight).toFixed(2)}</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-[11px] text-neutral-600">No rules fired — base prior only.</p>
						{/if}
					</div>

					<!-- ─── Incentives (UIP) ──────────────────────── -->
					<div class="bg-neutral-950 p-5">
						<div class="mb-3 flex items-baseline justify-between">
							<h2 class="text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">Incentives</h2>
							<span class="font-mono text-[10px] text-neutral-600">UIP</span>
						</div>

						{#if sessionData.incentives}
							{@const inc = sessionData.incentives}
							<div class="space-y-3">
								{#if inc.wallet}
									<div class="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
										<div class="mb-1 flex items-baseline justify-between">
											<span class="text-[12px] font-medium text-neutral-200">{inc.programName ?? 'Loyalty program'}</span>
											{#if inc.wallet.tierCurrent}
												<span class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{inc.wallet.tierCurrent}</span>
											{/if}
										</div>
										<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
											<dt class="text-neutral-500">balance</dt>
											<dd class="font-mono tabular-nums text-neutral-200">{inc.wallet.balanceActive} {inc.wallet.unit}</dd>
											{#if inc.wallet.tierNext && inc.wallet.unitsToNext != null}
												<dt class="text-neutral-500">to {inc.wallet.tierNext}</dt>
												<dd class="font-mono tabular-nums {inc.wallet.unitsToNext <= 500 ? 'text-amber-400' : 'text-neutral-300'}">
													{inc.wallet.unitsToNext} {inc.wallet.unit}
												</dd>
											{/if}
										</dl>
									</div>
								{/if}

								{#if inc.codes.length > 0}
									<div>
										<div class="mb-1.5 text-[10px] tracking-wider text-neutral-500 uppercase">Applied codes</div>
										<div class="flex flex-wrap gap-1.5">
											{#each inc.codes as c}
												<span class="rounded bg-emerald-900/40 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
													{c.code}<span class="ml-1 text-[9px] text-emerald-500/70 uppercase">{c.type}</span>
												</span>
											{/each}
										</div>
									</div>
								{/if}

								{#if inc.discounts.length > 0}
									<div>
										<div class="mb-1.5 text-[10px] tracking-wider text-neutral-500 uppercase">Active discounts</div>
										<div class="space-y-1.5">
											{#each inc.discounts as d}
												<div class="flex items-baseline justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-1.5">
													<div class="min-w-0 flex-1">
														<div class="truncate text-[12px] text-neutral-200">{d.title}</div>
														<div class="font-mono text-[10px] text-neutral-500">
															target: {d.target}{#if d.code} · code: {d.code}{/if}
														</div>
													</div>
													<div class="shrink-0 font-mono text-[11px] tabular-nums text-emerald-400">
														−${(d.amount / 100).toFixed(2)}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{:else}
							<p class="text-[11px] text-neutral-600">No incentives applied — no codes, no loyalty context.</p>
						{/if}
					</div>

					<!-- ─── Layout Decision ────────────────────────── -->
					<div class="bg-neutral-950 p-5">
						<h2 class="mb-3 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase">Layout Decision</h2>

						{#if latestLog}
							<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
								<dt class="text-neutral-500">type</dt>
								<dd class="text-neutral-200">{latestLog.type}</dd>

								<dt class="text-neutral-500">persona</dt>
								<dd class="{PERSONA_TEXT_COLORS[latestLog.persona] ?? 'text-neutral-200'} font-medium">{latestLog.persona}</dd>

								<dt class="text-neutral-500">category</dt>
								<dd class="text-neutral-200">{latestLog.categorySlug}</dd>

								<dt class="text-neutral-500">model</dt>
								<dd class="font-mono text-[11px] tabular-nums {latestLog.model?.includes('sonnet') ? 'text-amber-400' : 'text-emerald-400'}">
									{latestLog.model ? latestLog.model.split('/').pop() : '—'}
								</dd>

								<dt class="text-neutral-500">cache</dt>
								<dd class="font-mono text-[11px] font-semibold {latestLog.cacheHit ? 'text-emerald-400' : 'text-amber-400'}">
									{latestLog.cacheHit ? 'HIT' : 'MISS'}
								</dd>

								<dt class="text-neutral-500">generation</dt>
								<dd class="font-mono text-[11px] tabular-nums text-neutral-200">{latestLog.generationMs}ms</dd>

								<dt class="text-neutral-500">tokens</dt>
								<dd class="font-mono text-[11px] tabular-nums text-neutral-200">
									{latestLog.inputTokens ?? '?'} in / {latestLog.outputTokens ?? '?'} out
								</dd>

								<dt class="text-neutral-500">cost</dt>
								<dd class="font-mono text-[11px] tabular-nums text-neutral-200">
									{latestLog.estimatedCost != null ? `$${latestLog.estimatedCost.toFixed(4)}` : '—'}
								</dd>

								<dt class="text-neutral-500">time</dt>
								<dd class="font-mono text-[11px] text-neutral-500">{new Date(latestLog.createdAt).toLocaleTimeString()}</dd>
							</dl>

							{@const stats = cumulativeStats}
							<div class="mt-4 border-t border-neutral-800 pt-3">
								<h3 class="mb-2 text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">Session Cost · {stats.count} gens</h3>
								<div class="grid grid-cols-3 gap-x-3 gap-y-3 text-[11px]">
									<div>
										<div class="text-neutral-500">cache hit</div>
										<div class="mt-0.5 font-mono tabular-nums text-[13px] text-neutral-100">{stats.cacheHitRate}%</div>
									</div>
									<div>
										<div class="text-neutral-500">avg time</div>
										<div class="mt-0.5 font-mono tabular-nums text-[13px] text-neutral-100">{stats.avgMs}ms</div>
									</div>
									<div>
										<div class="text-neutral-500">tokens</div>
										<div class="mt-0.5 font-mono tabular-nums text-[13px] text-neutral-100">{stats.totalTokens.toLocaleString()}</div>
									</div>
									<div>
										<div class="text-neutral-500">total cost</div>
										<div class="mt-0.5 font-mono tabular-nums text-[13px] text-neutral-100">${stats.totalCost.toFixed(4)}</div>
									</div>
									<div>
										<div class="text-neutral-500">sonnet fb</div>
										<div class="mt-0.5 font-mono tabular-nums text-[13px] {stats.sonnetFallbacks > 0 ? 'text-amber-400' : 'text-neutral-100'}">{stats.sonnetFallbacks}</div>
									</div>
								</div>
							</div>
						{:else}
							<p class="text-[11px] text-neutral-600">No generations yet.</p>
						{/if}
					</div>

					<!-- ─── Product Enrichment (expandable) ──────── -->
					<div class="bg-neutral-950 p-5">
						<button
							onclick={() => enrichmentOpen = !enrichmentOpen}
							class="flex w-full items-center justify-between text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase hover:text-neutral-200"
						>
							<span>Product Enrichment</span>
							<span class="text-base leading-none text-neutral-500">{enrichmentOpen ? '−' : '+'}</span>
						</button>

						{#if enrichmentOpen}
							<div class="mt-3 max-h-72 overflow-auto">
								{#if enrichmentLoading}
									<p class="py-4 text-center text-[11px] text-neutral-500">Loading enrichment data…</p>
								{:else if enrichmentProducts.length === 0}
									<p class="py-4 text-center text-[11px] text-neutral-500">
										{sessionData?.crossSession?.currentCategory
											? `No enrichment data for "${sessionData.crossSession.currentCategory}".`
											: 'Browse a category to see enrichment data.'}
									</p>
								{:else}
									{@const currentPersona = sessionData?.inference?.primary || 'gatherer'}
									<table class="w-full table-fixed text-[11px]">
										<colgroup>
											<col style="width: 44%" />
											<col style="width: 12%" />
											<col style="width: 8%" />
											<col style="width: 8%" />
											<col style="width: 8%" />
											<col style="width: 8%" />
											<col style="width: 12%" />
										</colgroup>
										<thead>
											<tr class="border-b border-neutral-800 text-left text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
												<th class="pb-2 pr-2">Product</th>
												<th class="pb-2 px-1 text-right">
													<span class={PERSONA_TEXT_COLORS[currentPersona]}>fit</span>
												</th>
												<th class="pb-2 px-1 text-right font-mono">g</th>
												<th class="pb-2 px-1 text-right font-mono">h</th>
												<th class="pb-2 px-1 text-right font-mono">r</th>
												<th class="pb-2 px-1 text-right font-mono">gi</th>
												<th class="pb-2 pl-2">Tag</th>
											</tr>
										</thead>
										<tbody>
											{#each enrichmentProducts as product, i}
												{@const fit = product.personaFit}
												{@const primaryFit = fit?.[currentPersona as keyof typeof fit] ?? 0.5}
												<tr class="border-b border-neutral-900 {i < 3 ? 'bg-neutral-900/50' : ''}">
													<td class="py-1.5 pr-2 text-neutral-200" title={product.name}>
														{#if i < 3}<span class="mr-1 text-amber-500">★</span>{/if}{product.name}
														{#if product.petProfile}
															<div class="mt-0.5 truncate text-[9px] text-neutral-500" title={`${product.petProfile.protein} · ${product.petProfile.lifeStage} · ${product.petProfile.format} · ${product.petProfile.dietary} · ${product.petProfile.petSize}`}>
																{product.petProfile.protein} · {product.petProfile.lifeStage} · {product.petProfile.format} · {product.petProfile.dietary} · {product.petProfile.petSize}
															</div>
															<div class="text-[9px] text-neutral-600">
																{product.priceTier ?? 'unpriced'} · Auto-Refill {Math.round(product.petProfile.subscriptionFit * 100)}%{product.petProfile.replenishmentDays ? ` · ${product.petProfile.replenishmentDays}d` : ''}
															</div>
														{/if}
														</td>
													<td class="py-1.5 px-1 text-right font-mono tabular-nums {PERSONA_TEXT_COLORS[currentPersona]}">
														{(primaryFit * 100).toFixed(0)}
													</td>
													<td class="py-1.5 px-1 text-right font-mono tabular-nums text-neutral-500">
														{fit ? (fit.gatherer * 100).toFixed(0) : '−'}
													</td>
													<td class="py-1.5 px-1 text-right font-mono tabular-nums text-neutral-500">
														{fit ? (fit.hunter * 100).toFixed(0) : '−'}
													</td>
													<td class="py-1.5 px-1 text-right font-mono tabular-nums text-neutral-500">
														{fit ? (fit.researcher * 100).toFixed(0) : '−'}
													</td>
													<td class="py-1.5 px-1 text-right font-mono tabular-nums text-neutral-500">
														{fit ? (fit.gifter * 100).toFixed(0) : '−'}
													</td>
													<td class="py-1.5 pl-2 align-top">
														<div class="truncate text-[10px] text-neutral-500" title={product.semanticTags.slice(0, 3).join(', ')}>
															{product.semanticTags[0] ?? ''}
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
									<div class="mt-2 text-[10px] text-neutral-600">
										<span class="text-amber-500">★</span> hero candidates · sorted by {currentPersona} fit · {enrichmentProducts.length} products
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
