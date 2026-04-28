/**
 * Triggers a subtle tactile pulse on iOS devices by briefly focusing and clicking a hidden checkbox.
 * This is a workaround for Apple disabling navigator.vibrate in PWAs.
 */
export function triggerHaptic() {
	// Let's try native vibration first (works on Android perfectly)
	if (typeof navigator !== 'undefined' && navigator.vibrate) {
		navigator.vibrate(15);
		return;
	}

	// The IOS "Invisible Switch" Hack
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.style.position = 'absolute';
	checkbox.style.opacity = '0';
	checkbox.style.pointerEvents = 'none';
	document.body.appendChild(checkbox);

	// Toggling the checkbox causes iOS Safari to fire a micro-haptic tick
	checkbox.focus();
	checkbox.click();
	
	// Clean up
	setTimeout(() => {
		if (document.body.contains(checkbox)) {
			document.body.removeChild(checkbox);
		}
	}, 50);
}

/**
 * Triggers a tiny audio pop if vibration isn't enough context.
 * Best used sparingly on major confirmations (like placing a bet).
 */
export function triggerAudioPop() {
	try {
		const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		
		osc.connect(gain);
		gain.connect(ctx.destination);
		
		// Very low frequency "thud" or "click"
		osc.type = 'sine';
		osc.frequency.setValueAtTime(150, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

		// Extremely short duration
		gain.gain.setValueAtTime(0.5, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.05);
	} catch (e) {
		console.warn('Audio Context not supported or allowed.');
	}
}
