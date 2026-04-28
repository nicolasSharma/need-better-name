// Web Audio API Synthesizer to prevent MP3 file bloat

let audioCtx: AudioContext | null = null;

const initAudio = () => {
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
	}
	if (audioCtx.state === 'suspended') {
		audioCtx.resume();
	}
	return audioCtx;
};

export const playPlink = () => {
	try {
		const ctx = initAudio();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		
		osc.type = 'sine';
		osc.frequency.setValueAtTime(800, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);

		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

		osc.connect(gain);
		gain.connect(ctx.destination);
		
		osc.start();
		osc.stop(ctx.currentTime + 0.1);
	} catch (e) {
		console.warn('Audio play failed', e);
	}
};

export const playThump = () => {
	try {
		const ctx = initAudio();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = 'triangle';
		osc.frequency.setValueAtTime(150, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start();
		osc.stop(ctx.currentTime + 0.2);
	} catch (e) {
		console.warn('Audio play failed', e);
	}
};

export const playChime = () => {
	try {
		const ctx = initAudio();
		
		const playNote = (freq: number, startTime: number) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			
			gain.gain.setValueAtTime(0, startTime);
			gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
			
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(startTime);
			osc.stop(startTime + 0.3);
		};

		playNote(523.25, ctx.currentTime); // C5
		playNote(659.25, ctx.currentTime + 0.1); // E5
	} catch (e) {
		console.warn('Audio play failed', e);
	}
};
