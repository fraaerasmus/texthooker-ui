<script lang="ts">
	import { mdiConnection } from '@mdi/js';
	import { onMount } from 'svelte';
	import { SocketConnection, socketChannels, type SocketChannel } from '../socket';
	import {
		continuousReconnect$,
		isPaused$,
		openDialog$,
		showConnectionErrors$,
	} from '../stores/stores';
	import Icon from './Icon.svelte';

	export let channel: SocketChannel = socketChannels.primary;

	let socketConnection: SocketConnection | undefined;
	let intitialAttemptDone = false;
	let wasConnected = false;
	let closeRequested = false;
	let socketState = channel.state$;

	$: connectedWithLabel = updateConnectedWithLabel(wasConnected);

	$: handleSocketState($socketState);

	onMount(() => {
		toggleSocket();

		return () => {
			closeRequested = true;
			socketConnection?.cleanUp();
		};
	});

	function handleSocketState(socketStateValue) {
		switch (socketStateValue) {
			case 0:
				wasConnected = false;
				closeRequested = false;
				break;
			case 1:
				intitialAttemptDone = true;
				wasConnected = true;
				break;
			case 3:
				if (!channel.autoReconnect) {
					if (
						$showConnectionErrors$ &&
						!closeRequested &&
						intitialAttemptDone &&
						channel.url$.getValue() &&
						(wasConnected || !$continuousReconnect$)
					) {
						$openDialog$ = {
							type: 'error',
							message: wasConnected
								? `Lost Connection to ${channel.name} Websocket`
								: `Unable to connect to ${channel.name} Websocket`,
							showCancel: false,
						};
					}

					$isPaused$ = true;
				}

				intitialAttemptDone = true;
				wasConnected = false;

				if (!closeRequested) {
					channel.reconnect$.next();
				}

				break;

			default:
				break;
		}

		connectedWithLabel = updateConnectedWithLabel(wasConnected);
	}

	function updateConnectedWithLabel(hasConnection: boolean) {
		return hasConnection ? `Connected with ${channel.url$.getValue()}` : 'Not Connected';
	}

	async function toggleSocket() {
		if ($socketState === 1 && socketConnection) {
			closeRequested = true;
			socketConnection.disconnect();
		} else {
			socketConnection = socketConnection || new SocketConnection(channel);
			socketConnection.connect();
		}
	}
</script>

{#if $socketState !== 0}
	<div
		class="hover:text-primary"
		class:text-red-500={$socketState !== -1}
		class:text-green-700={$socketState === 1}
		title={connectedWithLabel}
	>
		<Icon path={mdiConnection} class="cursor-pointer mx-2" on:click={toggleSocket} />
	</div>
{:else}
	<span class="animate-ping relative inline-flex rounded-full h-3 w-3 mx-3 bg-primary" />
{/if}
