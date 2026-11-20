import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT_DIR, 'public', 'audio');

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const forceRegenerate = process.argv.includes('--force');

function resolveApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (process.platform === 'win32') {
    try {
      const userVal = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'GEMINI_API_KEY\', \'User\')"',
        { encoding: 'utf8' }
      ).trim();
      if (userVal) return userVal;

      const machineVal = execSync(
        'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'GEMINI_API_KEY\', \'Machine\')"',
        { encoding: 'utf8' }
      ).trim();
      if (machineVal) return machineVal;
    } catch {
      // Ignore PowerShell fallback failures
    }
  }
  return '';
}

function extractAudioPart(responseJson) {
  if (Array.isArray(responseJson?.steps)) {
    for (let i = responseJson.steps.length - 1; i >= 0; i--) {
      const step = responseJson.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === 'audio' && typeof part.data === 'string' && part.data.length > 0) {
            return { data: part.data, mimeType: part.mime_type ?? '' };
          }
        }
      }
    }
  }
  if (Array.isArray(responseJson?.outputs)) {
    for (const part of responseJson.outputs) {
      if (part?.type === 'audio' && typeof part.data === 'string' && part.data.length > 0) {
        return { data: part.data, mimeType: part.mime_type ?? '' };
      }
    }
  }
  return null;
}

async function callGeminiInteraction(apiKey, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Api-Revision': '2026-05-20',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: Non-JSON response (${text.slice(0, 200)})`);
  }

  if (!res.ok) {
    const errMsg = json?.error?.message ?? json?.message ?? text.slice(0, 300);
    throw new Error(`HTTP ${res.status}: ${errMsg}`);
  }

  return json;
}

function shouldSkip(filePath) {
  if (forceRegenerate) return false;
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 1024;
  } catch {
    return false;
  }
}

async function main() {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is not set in environment variables.');
    process.exit(1);
  }

  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const ttsTasks = [
    {
      filename: 'voice-welcome.wav',
      text: 'Pocket Arcade! Select your cartridge.',
      style: 'energetic retro arcade announcer',
    },
    {
      filename: 'voice-gameover.wav',
      text: 'Game Over!',
      style: 'dramatic retro arcade announcer',
    },
    {
      filename: 'voice-highscore.wav',
      text: 'New High Score!',
      style: 'excited triumphant arcade announcer',
    },
    {
      filename: 'voice-revive.wav',
      text: 'Second chance! Keep going!',
      style: 'energetic arcade announcer',
    },
  ];

  let generatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of ttsTasks) {
    const outPath = path.join(AUDIO_DIR, item.filename);
    if (shouldSkip(outPath)) {
      console.log(`[SKIP] ${item.filename} already exists`);
      skippedCount++;
      continue;
    }

    console.log(`[TTS] Generating ${item.filename} via gemini-3.8-flash-tts...`);
    try {
      const payload = {
        model: 'gemini-3.8-flash-tts',
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: item.text,
                annotations: [
                  {
                    type: 'speech_metadata',
                    style: item.style,
                  },
                ],
              },
            ],
          },
        ],
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: 'Puck' }],
        },
      };

      const json = await callGeminiInteraction(apiKey, payload);
      const audio = extractAudioPart(json);
      if (!audio) {
        throw new Error('Response succeeded but contained no audio content block.');
      }

      const buf = Buffer.from(audio.data, 'base64');
      fs.writeFileSync(outPath, buf);
      console.log(`[OK]   ${item.filename} (${buf.length} bytes, ${audio.mimeType || 'audio/wav'})`);
      generatedCount++;
    } catch (err) {
      console.error(`[WARN] Failed ${item.filename}: ${err instanceof Error ? err.message : String(err)}`);
      failedCount++;
    }
  }

  const bgmPath = path.join(AUDIO_DIR, 'arcade-bgm.mp3');
  if (shouldSkip(bgmPath)) {
    console.log('[SKIP] arcade-bgm.mp3 already exists');
    skippedCount++;
  } else {
    console.log('[MUSIC] Generating arcade-bgm.mp3 via lyria-3.5...');
    try {
      const payload = {
        model: 'lyria-3.5',
        input:
          'Modern high-energy futuristic mobile arcade soundtrack, crisp electronic chiptune arpeggios, punchy synth bassline, bright neon cyber-pop groove, clean studio production, instrumental seamless loop, 128 BPM, no vocals',
        response_format: { type: 'audio' },
      };

      const json = await callGeminiInteraction(apiKey, payload);
      const audio = extractAudioPart(json);
      if (!audio) {
        throw new Error('Response succeeded but contained no audio content block.');
      }
      
      const buf = Buffer.from(audio.data, 'base64');
      fs.writeFileSync(bgmPath, buf);
      console.log(`[OK]   arcade-bgm.mp3 (${buf.length} bytes, ${audio.mimeType || 'audio/mpeg'})`);
      generatedCount++;
    } catch (err) {
      console.error(`[WARN] Failed arcade-bgm.mp3: ${err instanceof Error ? err.message : String(err)}`);
      failedCount++;
    }
  }

  console.log(
    `Summary: generated=${generatedCount}, skipped=${skippedCount}, failed=${failedCount}`
  );
  if (generatedCount === 0 && skippedCount === 0 && failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
