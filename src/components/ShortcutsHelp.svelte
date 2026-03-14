<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ close: void }>();

	const shortcuts: { keys: string[]; description: string }[] = [
		{ keys: ['?'], description: 'Show this help' },
		{ keys: ['S'], description: 'Toggle settings' },
		{ keys: ['Escape'], description: 'Close settings / deselect lines' },
		{ keys: ['D'], description: 'Delete last line' },
		{ keys: ['Shift', 'D'], description: 'Delete all lines' },
		{ keys: ['Alt', 'Delete'], description: 'Delete last line' },
		{ keys: ['Delete'], description: 'Delete selected lines' },
		{ keys: ['Alt', 'A'], description: 'Delete all lines & reset timer' },
		{ keys: ['Alt', 'Q'], description: 'Delete all lines' },
		{ keys: ['Ctrl', 'Space'], description: 'Pause / resume timer' },
		{ keys: ['T'], description: 'Translate last line' },
	];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	on:click|self={() => dispatch('close')}
>
	<div class="modal-box relative max-w-sm w-full">
		<button
			class="btn btn-sm btn-ghost absolute top-2 right-2"
			on:click={() => dispatch('close')}
		>✕</button>
		<h3 class="font-bold text-lg mb-4">Keyboard Shortcuts</h3>
		<table class="w-full text-sm">
			<tbody>
				{#each shortcuts as { keys, description }}
					<tr class="border-b border-base-300 last:border-0">
						<td class="py-1.5 pr-4 w-1/2">
							{#each keys as key, i}
								{#if i > 0}<span class="mx-0.5 opacity-50">+</span>{/if}
								<kbd class="kbd kbd-sm">{key}</kbd>
							{/each}
						</td>
						<td class="py-1.5 opacity-75">{description}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
