#!/usr/bin/env node
/**
 * Hype reel generator — the joke version.
 *
 * Procedurally generates SFX via ffmpeg aevalsrc, burns trailer-style
 * text overlays with ImageMagick, applies per-scene VFX (zoom, shake,
 * glitch, flash) via ffmpeg filter chains, mixes narration + SFX +
 * rumble music bed.
 *
 * Env:
 *   OPENAI_API_KEY auto-loaded from ~/Workspace/dev/apps/rally-hq/.env.local
 *   SKIP_TTS=1     reuse audio/ from a previous run
 *   SKIP_SFX=1     reuse sfx/ from a previous run
 *   SKIP_FRAMES=1  reuse frames/ from a previous run
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
const AUDIO_DIR = path.join(ROOT, 'hype-audio');
const SFX_DIR = path.join(ROOT, 'hype-sfx');
const FRAMES_DIR = path.join(ROOT, 'hype-frames');
const CLIPS_DIR = path.join(ROOT, 'hype-clips');
const OUT_DIR = path.join(ROOT, 'out');

for (const d of [AUDIO_DIR, SFX_DIR, FRAMES_DIR, CLIPS_DIR, OUT_DIR]) fs.mkdirSync(d, { recursive: true });

// ─── env ───────────────────────────────────────────────────────────
function loadOpenAIKey() {
	if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
	const rallyEnv = path.resolve(process.env.HOME || '', 'Workspace/dev/apps/rally-hq/.env.local');
	if (!fs.existsSync(rallyEnv)) throw new Error('OPENAI_API_KEY not set and rally-hq .env.local not found');
	const m = fs.readFileSync(rallyEnv, 'utf-8').match(/^OPENAI_API_KEY=(.+)$/m);
	if (!m) throw new Error('OPENAI_API_KEY not found in rally-hq .env.local');
	return m[1].trim().replace(/^["']|["']$/g, '');
}
const OPENAI_API_KEY = loadOpenAIKey();

const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'hype-captions.json'), 'utf-8'));
const VOICE = captions.voice || 'ash';
const TTS_MODEL = captions.model || 'gpt-4o-mini-tts';
const INSTRUCTIONS = captions.instructions || null;

const VIDEO_W = 1440;
const VIDEO_H = 900;
const FPS = 30;

// ─── TTS ───────────────────────────────────────────────────────────
async function generateTTS(text, outputPath) {
	const payload = { model: TTS_MODEL, voice: VOICE, input: text, response_format: 'mp3' };
	if (INSTRUCTIONS && TTS_MODEL.startsWith('gpt-4o')) payload.instructions = INSTRUCTIONS;
	const res = await fetch('https://api.openai.com/v1/audio/speech', {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
	fs.writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
}

// ─── SFX synthesis (all pure aevalsrc) ─────────────────────────────
// Each function writes an mp3 to `out`. Amplitudes tuned to ~-6dB peak.

// Wrapper that escapes commas so ffmpeg doesn't eat them as filter-arg separators
function synthSfx(expr, durationSec, out) {
	const escaped = expr.replace(/,/g, '\\,');
	execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `aevalsrc=${escaped}:d=${durationSec}`, '-ar', '44100', out], { stdio: 'ignore' });
}

function sfxBuildup(out) {
	synthSfx(`0.45*sin(2*PI*t*(150+1050*t))*min(1,t*2)`, 1.5, out);
}

function sfxImpact(out) {
	synthSfx(`0.8*sin(2*PI*t*60)*exp(-4*t) + 0.3*sin(2*PI*t*120)*exp(-6*t)`, 0.8, out);
}

function sfxWhooshUp(out) {
	synthSfx(`0.5*sin(2*PI*t*(400+2100*t))*(1-t)`, 0.7, out);
}

function sfxBassDrop(out) {
	synthSfx(`0.9*sin(2*PI*t*45)*exp(-2*t) + 0.35*sin(2*PI*t*90)*exp(-5*t) + 0.25*sin(2*PI*t*180)*exp(-10*t)`, 1.2, out);
}

function sfxLaser(out) {
	synthSfx(`0.5*sin(2*PI*t*(2200-4200*t))*exp(-3*t)`, 0.45, out);
}

function sfxWubDrop(out) {
	synthSfx(`(0.85*sin(2*PI*t*55)+0.4*sin(2*PI*t*110))*((sin(2*PI*t*5)+1)/2)*min(1,t*4)`, 2.5, out);
}

function sfxFinal(out) {
	synthSfx(`0.3*sin(2*PI*t*55) + 0.25*sin(2*PI*t*82.4) + 0.25*sin(2*PI*t*110) + 0.2*sin(2*PI*t*165)`, 2, out);
}

function sfxRumbleBed(out, durationSec) {
	synthSfx(`0.18*sin(2*PI*t*40)*((sin(2*PI*t*0.3)+1.2)/2.2) + 0.1*sin(2*PI*t*80)*((sin(2*PI*t*0.5)+1.2)/2.2)`, durationSec, out);
}

const SFX_GENERATORS = {
	buildup: sfxBuildup,
	impact: sfxImpact,
	'whoosh-up': sfxWhooshUp,
	'bass-drop': sfxBassDrop,
	laser: sfxLaser,
	'wub-drop': sfxWubDrop,
	final: sfxFinal,
};

// ─── Helpers ───────────────────────────────────────────────────────
function probeDuration(p) {
	const out = execFileSync('ffprobe', [
		'-v', 'error',
		'-show_entries', 'format=duration',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		p,
	]).toString().trim();
	return parseFloat(out);
}

// ─── Frame builder: burn big trailer text onto screenshot ──────────
function buildFrame(scene, framePath) {
	const src = path.join(SCREENSHOTS_DIR, scene.image);
	if (!fs.existsSync(src)) throw new Error(`Screenshot not found: ${src}`);

	const bigText = scene.bigText || '';
	const subText = scene.subText || '';

	// Darken the screenshot so the text pops.
	const args = [
		src,
		'-resize', `${VIDEO_W}x${VIDEO_H}^`,
		'-gravity', 'center',
		'-background', '#000',
		'-extent', `${VIDEO_W}x${VIDEO_H}`,

		// Vignette-ish overall darken
		'(',
			'-size', `${VIDEO_W}x${VIDEO_H}`,
			'xc:rgba(0,0,0,0.55)',
		')',
		'-gravity', 'center',
		'-composite',
	];

	// Big centered headline — Impact if available, else Helvetica-Bold
	if (bigText) {
		args.push(
			'(',
				'-background', 'none',
				'-fill', '#ffffff',
				'-stroke', '#000',
				'-strokewidth', '4',
				'-font', 'Impact',
				'-pointsize', bigText.length > 22 ? '60' : '110',
				'-size', `${VIDEO_W - 120}x`,
				'-gravity', 'center',
				`caption:${bigText}`,
			')',
			'-gravity', 'center',
			'-geometry', '+0+0',
			'-composite',
		);
	}

	if (subText) {
		args.push(
			'(',
				'-background', 'none',
				'-fill', '#d4d4d4',
				'-font', 'Helvetica',
				'-pointsize', '22',
				'-size', `${VIDEO_W - 200}x`,
				'-gravity', 'center',
				`caption:${subText}`,
			')',
			'-gravity', 'south',
			'-geometry', '+0+80',
			'-composite',
		);
	}

	args.push(framePath);
	execFileSync('magick', args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

// ─── Clip builder with per-scene VFX filter ────────────────────────
function vfxFilter(vfx, duration) {
	// Output always ends at 1440x900 30fps. Zoompan uses d= in output frames.
	const frames = Math.max(2, Math.round(duration * FPS));
	switch (vfx) {
		case 'zoom-in':
			// Upscale input first so zoompan has pixels to work with
			return `scale=${VIDEO_W * 2}:${VIDEO_H * 2},zoompan=z='min(1+0.0008*in,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${VIDEO_W}x${VIDEO_H}:fps=${FPS}`;
		case 'zoom-out':
			return `scale=${VIDEO_W * 2}:${VIDEO_H * 2},zoompan=z='max(1.25-0.0008*in,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${VIDEO_W}x${VIDEO_H}:fps=${FPS}`;
		case 'shake':
			// Crop with jittering offset for shake (add padding so crop has room)
			return `scale=${VIDEO_W + 40}:${VIDEO_H + 40},crop=${VIDEO_W}:${VIDEO_H}:'20+10*sin(2*PI*t*14)':'20+10*cos(2*PI*t*16)',fps=${FPS}`;
		case 'glitch':
			// Film-grain glitch: animated noise + brightness flicker via eval=frame
			return `scale=${VIDEO_W}:${VIDEO_H},eq=brightness='0.1*sin(2*PI*t*22)':contrast=1.2:saturation=0.85:eval=frame,noise=alls=18:allf=t+u,fps=${FPS}`;
		case 'flash':
			// Bright flash at t=0 that decays
			return `scale=${VIDEO_W}:${VIDEO_H},eq=brightness='0.8*exp(-8*t)':eval=frame,fps=${FPS}`;
		default:
			return `scale=${VIDEO_W}:${VIDEO_H},fps=${FPS}`;
	}
}

function buildClip(scene, framePath, narrationPath, sfxPath, duration, clipPath) {
	// Video: still image filtered by VFX, duration = full narration + small tail
	// Audio: narration + SFX mixed (SFX at t=0, narration also starts ~0.2s after sfx onset for punch)
	const vfx = vfxFilter(scene.vfx, duration);

	// Audio map: [sfx] + [narration delayed by 200ms] → amix
	// SFX gets a subtle fade-in, narration gets priority at -0dB
	const audioFilter = [
		`[1:a]volume=1.0[sfxa]`,
		`[2:a]adelay=200|200,volume=1.1[nara]`,
		`[sfxa][nara]amix=inputs=2:duration=longest:dropout_transition=0,volume=1.2[mix]`,
	].join(';');

	const args = [
		'-y',
		'-loop', '1', '-t', duration.toFixed(3), '-i', framePath,
		'-i', sfxPath,
		'-i', narrationPath,
		'-filter_complex', `[0:v]${vfx}[v];${audioFilter}`,
		'-map', '[v]',
		'-map', '[mix]',
		'-c:v', 'libx264',
		'-tune', 'stillimage',
		'-pix_fmt', 'yuv420p',
		'-r', String(FPS),
		'-c:a', 'aac', '-b:a', '192k',
		'-t', duration.toFixed(3),
		clipPath,
	];
	execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
	const skipTTS = process.env.SKIP_TTS === '1';
	const skipSFX = process.env.SKIP_SFX === '1';
	const skipFrames = process.env.SKIP_FRAMES === '1';

	console.log(`\nHype reel generator`);
	console.log(`  voice: ${VOICE} (${TTS_MODEL}) — trailer mode`);
	console.log(`  scenes: ${captions.scenes.length}`);
	console.log(`  output: ${path.join(OUT_DIR, 'demo-reel-hype.mp4')}\n`);

	// Step 1: TTS narration per scene
	console.log('[1/5] Generating trailer narration');
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const p = path.join(AUDIO_DIR, `${idx}.mp3`);
		if (skipTTS && fs.existsSync(p)) { console.log(`  ${idx} cached`); continue; }
		console.log(`  ${idx} "${captions.scenes[i].narration}"`);
		await generateTTS(captions.scenes[i].narration, p);
		await new Promise(r => setTimeout(r, 700));
	}

	// Step 2: Synthesize SFX (unique cues deduped)
	console.log('\n[2/5] Synthesizing SFX');
	const uniqueSfx = [...new Set(captions.scenes.map(s => s.sfx).filter(Boolean))];
	for (const cue of uniqueSfx) {
		const p = path.join(SFX_DIR, `${cue}.mp3`);
		if (skipSFX && fs.existsSync(p)) { console.log(`  ${cue} cached`); continue; }
		const gen = SFX_GENERATORS[cue];
		if (!gen) { console.warn(`  ${cue} — no generator, skipping`); continue; }
		console.log(`  ${cue}`);
		gen(p);
	}

	// Step 3: Build frames (screenshot + big text overlay)
	console.log('\n[3/5] Burning trailer frames');
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const p = path.join(FRAMES_DIR, `${idx}.png`);
		if (skipFrames && fs.existsSync(p)) { console.log(`  ${idx} cached`); continue; }
		console.log(`  ${idx} ${captions.scenes[i].bigText || ''}`);
		buildFrame(captions.scenes[i], p);
	}

	// Step 4: Per-scene clips
	console.log('\n[4/5] Rendering clips with VFX');
	const clipPaths = [];
	let totalDuration = 0;
	for (let i = 0; i < captions.scenes.length; i++) {
		const idx = String(i + 1).padStart(2, '0');
		const scene = captions.scenes[i];
		const narrationPath = path.join(AUDIO_DIR, `${idx}.mp3`);
		const sfxPath = path.join(SFX_DIR, `${scene.sfx}.mp3`);
		const framePath = path.join(FRAMES_DIR, `${idx}.png`);
		const clipPath = path.join(CLIPS_DIR, `${idx}.mp4`);

		const narrSec = probeDuration(narrationPath);
		// Duration = max(narration + 0.35s tail, sfx length + 0.15s) so sfx never clips
		const sfxSec = probeDuration(sfxPath);
		const duration = Math.max(narrSec + 0.35, sfxSec + 0.15, 1.2);
		totalDuration += duration;
		console.log(`  ${idx} ${scene.vfx}/${scene.sfx} narr=${narrSec.toFixed(2)}s sfx=${sfxSec.toFixed(2)}s total=${duration.toFixed(2)}s`);
		buildClip(scene, framePath, narrationPath, sfxPath, duration, clipPath);
		clipPaths.push(clipPath);
	}

	// Step 5: Concat clips, then overlay music bed rumble under the full mix
	console.log('\n[5/5] Concatenating + adding music bed');
	const concatFile = path.join(ROOT, 'hype-concat.txt');
	fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n') + '\n');

	const concatOut = path.join(CLIPS_DIR, 'concat-raw.mp4');
	execFileSync('ffmpeg', [
		'-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
		'-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
		'-c:a', 'aac', '-b:a', '192k',
		concatOut,
	], { stdio: ['ignore', 'pipe', 'pipe'] });

	// Generate music bed for full duration
	const bedPath = path.join(SFX_DIR, 'rumble-bed.mp3');
	console.log(`  generating ${totalDuration.toFixed(1)}s rumble bed`);
	sfxRumbleBed(bedPath, totalDuration + 1);

	// Final: overlay music bed at -14dB under the concat audio
	const outFile = path.join(OUT_DIR, 'demo-reel-hype.mp4');
	execFileSync('ffmpeg', [
		'-y',
		'-i', concatOut,
		'-i', bedPath,
		'-filter_complex', '[0:a]volume=1.0[a0];[1:a]volume=0.22[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]',
		'-map', '0:v', '-map', '[aout]',
		'-c:v', 'copy',
		'-c:a', 'aac', '-b:a', '192k',
		'-movflags', '+faststart',
		outFile,
	], { stdio: ['ignore', 'pipe', 'pipe'] });

	const stat = fs.statSync(outFile);
	console.log(`\n✓ ${outFile}`);
	console.log(`  ${(stat.size / 1024 / 1024).toFixed(1)} MB · ${totalDuration.toFixed(1)}s`);
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
