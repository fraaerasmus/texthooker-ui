import { BehaviorSubject, NEVER, Subject, Subscription, delay, filter, of, switchMap } from 'rxjs';
import {
	blurAutoTranslatedLines$,
	continuousReconnect$,
	lineData$,
	newLine$,
	reconnectSecondarySocket$,
	reconnectSocket$,
	reconnectTranslationSocket$,
	secondarySocketState$,
	secondaryWebsocketUrl$,
	socketState$,
	translationSocketState$,
	translationWebsocketUrl$,
	websocketUrl$,
} from './stores/stores';

import { LineType } from './types';

export interface SocketChannel {
	name: string;
	url$: BehaviorSubject<string>;
	state$: BehaviorSubject<number>;
	reconnect$: Subject<void>;
	handleMessage: (data: string) => void;
	// reconnects regardless of the setting and never interrupts the user when it drops
	autoReconnect?: boolean;
}

function appendLine(data: string) {
	let line = data;

	try {
		line = JSON.parse(data)?.sentence || data;
	} catch (_) {
		// no-op
	}

	newLine$.next([line, LineType.SOCKET]);
}

function attachTranslation(translation: string) {
	const lines = lineData$.getValue();
	const index = lines.length - 1;

	if (index >= 0) {
		lines[index] = { ...lines[index], translation, blurTranslation: blurAutoTranslatedLines$.getValue() };
		lineData$.next(lines);
	}
}

export const socketChannels: Record<'primary' | 'secondary' | 'translation', SocketChannel> = {
	primary: {
		name: 'primary',
		url$: websocketUrl$,
		state$: socketState$,
		reconnect$: reconnectSocket$,
		handleMessage: appendLine,
	},
	secondary: {
		name: 'secondary',
		url$: secondaryWebsocketUrl$,
		state$: secondarySocketState$,
		reconnect$: reconnectSecondarySocket$,
		handleMessage: appendLine,
	},
	translation: {
		name: 'translation',
		url$: translationWebsocketUrl$,
		state$: translationSocketState$,
		reconnect$: reconnectTranslationSocket$,
		handleMessage: attachTranslation,
		autoReconnect: true,
	},
};

export class SocketConnection {
	private websocketUrl: string;

	private socket: WebSocket | undefined;

	private subscriptions: Subscription[] = [];

	constructor(private channel: SocketChannel) {
		this.subscriptions.push(
			channel.url$.subscribe((websocketUrl) => {
				if (websocketUrl !== this.websocketUrl) {
					this.websocketUrl = websocketUrl;
					this.reloadSocket();
				}
			}),
			(channel.autoReconnect ? of(true) : continuousReconnect$)
				.pipe(
					switchMap((reconnect) => (reconnect ? channel.reconnect$.pipe(delay(3000)) : NEVER)),
					filter(() => this.socket?.readyState === 3)
				)
				.subscribe(() => this.reloadSocket())
		);
	}

	getCurrentUrl() {
		return this.websocketUrl;
	}

	connect() {
		if (this.socket?.readyState < 2) {
			return;
		}

		if (!this.websocketUrl) {
			this.channel.state$.next(3);
			return;
		}

		this.channel.state$.next(0);

		try {
			this.socket = new WebSocket(this.websocketUrl);
			this.socket.onopen = this.updateSocketState.bind(this);
			this.socket.onclose = this.updateSocketState.bind(this);
			this.socket.onmessage = (event) => this.channel.handleMessage(event.data);
		} catch (error) {
			this.channel.state$.next(3);
		}
	}

	disconnect() {
		if (this.socket?.readyState === 1) {
			this.socket.close(1000, 'User Request');
		}
	}

	cleanUp() {
		this.disconnect();

		for (let index = 0, { length } = this.subscriptions; index < length; index += 1) {
			this.subscriptions[index].unsubscribe();
		}
	}

	private reloadSocket() {
		this.disconnect();
		this.socket = undefined;
		this.connect();
	}

	private updateSocketState() {
		if (!this.socket) {
			return;
		}

		this.channel.state$.next(this.socket.readyState);
	}
}
