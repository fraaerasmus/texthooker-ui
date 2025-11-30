<script lang="ts">
	import { mdiTrophy } from '@mdi/js';
	import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		displayVertical$,
		enableLineAnimation$,
		milestoneLines$,
		preserveWhitespace$,
		reverseLineOrder$,
		lineData$,
		autoTranslateLines$,
		blurAutoTranslatedLines$,
		unblurTLTimer$,
		showTranslateButton$,
		geminiApiKey$,
	} from '../stores/stores';
	import type { LineItem, LineItemEditEvent } from '../types';
	import { dummyFn, newLineCharacter, updateScroll } from '../util';
	import Icon from './Icon.svelte';

	export let line: LineItem;
	export let index: number;
	export let isLast: boolean;
	export let pipWindow: Window = undefined;

	export function deselect() {
		isSelected = false;
	}

	export function getIdIfSelected(range: Range) {
		return isSelected || range.intersectsNode(paragraph) ? line.id : undefined;
	}

	const dispatch = createEventDispatcher<{ deselected: string; selected: string; edit: LineItemEditEvent }>();

	let paragraph: HTMLElement;
	let originalText = '';
	let isSelected = false;
	let isEditable = false;

	$: isVerticalDisplay = !pipWindow && $displayVertical$;

	onMount(() => {
		if (isLast) {
			updateScroll(
				pipWindow || window,
				paragraph.parentElement,
				$reverseLineOrder$,
				isVerticalDisplay,
				$enableLineAnimation$ ? 'smooth' : 'auto',
			);
			// Auto-translate if enabled
			if ($autoTranslateLines$ && !line.translation) {
				translateLine($blurAutoTranslatedLines$);
			}
		}
	});

	onDestroy(() => {
		document.removeEventListener('click', clickOutsideHandler, false);
		dispatch('edit', { inEdit: false });
	});

	function handleDblClick(event: MouseEvent) {
		if (pipWindow) {
			return;
		}

		window.getSelection()?.removeAllRanges();

		if (event.ctrlKey || event.metaKey) {
			if (isSelected) {
				isSelected = false;
				dispatch('deselected', line.id);
			} else {
				isSelected = true;
				dispatch('selected', line.id);
			}
		} else {
			originalText = paragraph.innerText;
			isEditable = true;

			dispatch('edit', { inEdit: true });

			document.addEventListener('click', clickOutsideHandler, false);

			tick().then(() => {
				paragraph.focus();
			});
		}
	}

	function clickOutsideHandler(event: MouseEvent) {
		const target = event.target as Node;

		if (!paragraph.contains(target)) {
			isEditable = false;
			document.removeEventListener('click', clickOutsideHandler, false);

			dispatch('edit', {
				inEdit: false,
				data: { originalText, newText: paragraph.innerText, lineIndex: index, line },
			});
		}
	}

	async function translateLine(blurTranslate: boolean = false) {
		try {
			// Get API key from settings or fallback to env variable
			const apiKey = $geminiApiKey$ || import.meta.env.VITE_GEMINI_API_KEY;

			if (!apiKey) {
				console.error('Gemini API key not configured. Please set it in Settings.');
				return;
			}

			// Use Gemini API for translation
			const response = await fetch(
				'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
				{
					method: 'POST',
					headers: {
						'x-goog-api-key': apiKey,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						contents: [{
							parts: [{
								text: `Translate this Japanese text to English: ${line.text}`
							}]
						}]
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`Gemini API error! Status: ${response.status}`);
			}

			const data = await response.json();
			const translation = data.candidates[0].content.parts[0].text;

			// Update line with translation
			line.translation = translation;
			line.blurTranslation = blurTranslate;

			if ($unblurTLTimer$ > 0 && line.blurTranslation) {
				setTimeout(() => {
					line.blurTranslation = false;
				}, $unblurTLTimer$ * 1000);
			}

			if (!line.text.endsWith('\n')) {
				line.text += '\n';
			}
			$lineData$[line.index] = line;

			if (isLast) {
				updateScroll(
					pipWindow || window,
					paragraph.parentElement,
					$reverseLineOrder$,
					isVerticalDisplay,
					$enableLineAnimation$ ? 'smooth' : 'auto',
				);
			}
		} catch (error) {
			console.error(`Error translating line ${line.id}:`, error);
		}
	}
</script>

{#key line.text}
	<div class="flex items-start gap-2">
		<p
			class="my-2 cursor-pointer border-2 flex-1"
			class:py-4={!isVerticalDisplay}
			class:px-2={!isVerticalDisplay}
			class:py-2={isVerticalDisplay}
			class:px-4={isVerticalDisplay}
			class:border-transparent={!isSelected}
			class:cursor-text={isEditable}
			class:border-primary={isSelected}
			class:border-accent-focus={isEditable}
			class:whitespace-pre-wrap={$preserveWhitespace$}
			contenteditable={isEditable}
			on:dblclick={handleDblClick}
			on:keyup={dummyFn}
			bind:this={paragraph}
			in:fly={{ x: isVerticalDisplay ? 100 : -100, duration: $enableLineAnimation$ ? 250 : 0 }}
		>
			{line.text}
			{#if line.translation}
				<p
					class:blur-translation={line.blurTranslation}
					style="color: #888; padding-bottom: 16px; padding-top: 16px; width: 100%; {line.blurTranslation
						? 'filter: blur(8px); transition: filter 0.2s;'
						: ''}"
					on:mouseenter={line.blurTranslation
						? function () {
								this.style.filter = 'blur(0px)';
								this.style.transition = 'filter 0.3s';
							}
						: undefined}
					on:mouseleave={line.blurTranslation
						? function () {
								this.style.filter = 'blur(8px)';
							}
						: undefined}
				>
					<i>{line.translation}</i>
				</p>
			{/if}
		</p>
		{#if $showTranslateButton$ && !pipWindow}
			<button
				class="hover:bg-gray-700"
				on:click={() => translateLine()}
				title="Translate"
				style="background-color: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; font-size: 14px; border-radius: 4px; cursor: pointer; transition: background-color 0.3s; margin-top: 0.5rem; margin-left: auto;"
				tabindex="-1"
			>
				🌐
			</button>
		{/if}
	</div>
{/key}
{@html newLineCharacter}
{#if $milestoneLines$.has(line.id)}
	<div
		class="flex justify-center text-xs my-2 py-2 border-primary border-dashed milestone"
		class:border-x-2={$displayVertical$}
		class:border-y-2={!$displayVertical$}
		class:py-4={!isVerticalDisplay}
		class:px-2={!isVerticalDisplay}
		class:py-2={isVerticalDisplay}
		class:px-4={isVerticalDisplay}
	>
		<div class="flex items-center">
			<Icon class={$displayVertical$ ? '' : 'mr-2'} path={mdiTrophy}></Icon>
			<span class:mt-2={$displayVertical$}>{$milestoneLines$.get(line.id)}</span>
		</div>
	</div>
	{@html newLineCharacter}
{/if}

<style>
	p:focus-visible {
		outline: none;
	}
</style>
