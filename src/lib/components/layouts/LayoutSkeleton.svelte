<div class="animate-pulse">
	<!-- Header skeleton -->
	<div class="mb-12">
		<div class="h-3 w-32 rounded bg-surface-muted"></div>
		<div class="mt-4 h-8 w-80 rounded bg-surface-muted"></div>
		<div class="mt-4 h-4 w-96 rounded bg-surface-muted"></div>
	</div>

	<!-- Hero skeleton -->
	<div class="mb-12 grid gap-8 lg:grid-cols-5">
		<div class="aspect-[4/3] rounded-sm bg-surface-muted lg:col-span-3"></div>
		<div class="flex flex-col justify-center gap-4 lg:col-span-2">
			<div class="h-3 w-20 rounded bg-surface-muted"></div>
			<div class="h-7 w-64 rounded bg-surface-muted"></div>
			<div class="h-4 w-full rounded bg-surface-muted"></div>
			<div class="h-4 w-3/4 rounded bg-surface-muted"></div>
			<div class="mt-4 h-6 w-24 rounded bg-surface-muted"></div>
		</div>
	</div>

	<!-- Grid skeleton -->
	<div class="grid gap-6 sm:grid-cols-2">
		{#each Array(4) as _}
			<div>
				<div class="aspect-[4/3] rounded-sm bg-surface-muted"></div>
				<div class="mt-4 h-5 w-48 rounded bg-surface-muted"></div>
				<div class="mt-2 h-4 w-full rounded bg-surface-muted"></div>
				<div class="mt-3 h-5 w-20 rounded bg-surface-muted"></div>
			</div>
		{/each}
	</div>
</div>
