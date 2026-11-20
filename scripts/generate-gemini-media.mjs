import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'public', 'assets');

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

function extractMediaPart(responseJson, targetType) {
  if (Array.isArray(responseJson?.steps)) {
    for (let i = responseJson.steps.length - 1; i >= 0; i--) {
      const step = responseJson.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === targetType && (part.data || part.uri)) {
            return {
              data: part.data ?? null,
              uri: part.uri ?? null,
              mimeType: part.mime_type ?? '',
            };
          }
        }
      }
    }
  }
  if (Array.isArray(responseJson?.outputs)) {
    for (const part of responseJson.outputs) {
      if (part?.type === targetType && (part.data || part.uri)) {
        return {
          data: part.data ?? null,
          uri: part.uri ?? null,
          mimeType: part.mime_type ?? '',
        };
      }
    }
  }
  return null;
}

async function downloadMediaUri(apiKey, uri) {
  let downloadUrl = uri.startsWith('http')
    ? uri
    : `https://generativelanguage.googleapis.com/v1beta/${uri.replace(/^\/+/, '')}`;
  if (!downloadUrl.includes(':download') && !downloadUrl.includes('alt=media')) {
    downloadUrl = `${downloadUrl}:download?alt=media`;
  }

  const res = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Download failed HTTP ${res.status}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function callGeminiInteraction(apiKey, payload, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Api-Revision': '2026-05-20',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
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

  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const mediaTasks = [
    {
      filename: 'app-icon.png',
      targetType: 'image',
      timeoutMs: 120000,
      payload: {
        model: 'gemini-nano-banana-2.1',
        input:
          'Minimalist sleek dark-navy and glowing cyan and magenta retro-futuristic handheld arcade console app icon, crisp vector lighting, centered composition, no text',
        response_format: {
          type: 'image',
          aspect_ratio: '1:1',
        },
      },
    },
    {
      filename: 'store-banner.png',
      targetType: 'image',
      timeoutMs: 120000,
      payload: {
        model: 'gemini-nano-banana-2.1',
        input:
          'Sleek futuristic neon arcade universe showcase banner with glowing cyan orbital rings, synthwave grid horizon, starfighter, and neon blocks on deep midnight blue background, clean graphic design, no text',
        response_format: {
          type: 'image',
          aspect_ratio: '16:9',
        },
      },
    },
    {
      filename: 'arcade-promo.mp4',
      targetType: 'video',
      timeoutMs: 300000,
      payload: {
        model: 'gemini-omni-1.2-flash',
        input: [
          {
            type: 'text',
            text: 'Smooth 3-second neon cyberpunk arcade console boot-up animation with glowing cyan orbital rings pulsing over a midnight synthwave grid and energetic retro synth swell',
          },
        ],
        response_format: {
          type: 'video',
          delivery: 'uri',
          aspect_ratio: '9:16',
          resolution: '360p',
          duration: '3s',
        },
      },
    },
  ];

  let generatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const task of mediaTasks) {
    const outPath = path.join(ASSETS_DIR, task.filename);
    if (shouldSkip(outPath)) {
      console.log(`[SKIP] ${task.filename} already exists`);
      skippedCount++;
      continue;
    }

    console.log(`[${task.targetType.toUpperCase()}] Generating ${task.filename} via ${task.payload.model}...`);
    try {
      const json = await callGeminiInteraction(apiKey, task.payload, task.timeoutMs);
      const media = extractMediaPart(json, task.targetType);
      if (!media) {
        throw new Error(`Response succeeded but contained no ${task.targetType} content block.`);
      }

      const buf = media.data
        ? Buffer.from(media.data, 'base64')
        : await downloadMediaUri(apiKey, media.uri);

      fs.writeFileSync(outPath, buf);
      console.log(`[OK]   ${task.filename} (${buf.length} bytes, ${media.mimeType || task.targetType})`);
      generatedCount++;
    } catch (err) {
      console.error(`[WARN] Failed ${task.filename}: ${err instanceof Error ? err.message : String(err)}`);
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
