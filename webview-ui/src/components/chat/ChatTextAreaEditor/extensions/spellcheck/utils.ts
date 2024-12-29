export function debounce(func: any, wait: any) {
	let timeout: any;

	return (...args: any) => {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(() => {
			func.apply(func, args);
		}, wait);
	};
}


export function createSpellCheckEnabledStore(getInitialValue: any) {
    let spellCheckEnabled = getInitialValue();
    const subscribers = new Set<(value: boolean) => void>();

    function subscribe(subscriber: (value: boolean) => void) {
        subscribers.add(subscriber);
        subscriber(spellCheckEnabled);

        return () => subscribers.delete(subscriber);
    }

    function set(newValue: any) {
        if (spellCheckEnabled !== newValue) {
            spellCheckEnabled = newValue;
            subscribers.forEach(subscriber => subscriber(spellCheckEnabled));
        }
    }

    function get() {
        return spellCheckEnabled;
    }

    return {
        subscribe,
        set,
        get
    };
}
