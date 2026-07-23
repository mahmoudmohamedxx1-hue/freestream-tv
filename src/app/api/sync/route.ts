import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cloud Sync API — sync favorites/history across devices.
 *
 * Uses file-based storage (no database needed).
 * Each user gets a sync key (random string stored in localStorage).
 * Devices with the same key share favorites/history.
 *
 * Endpoints:
 *   GET  /api/sync?key=KEY        → get all synced data
 *   POST /api/sync                 → save data { key, favorites, recent, customChannels }
 *   POST /api/sync/new             → create new sync key
 */

const SYNC_DIR = '/home/z/my-project/sync'

async function ensureDir() {
  try { await mkdir(SYNC_DIR, { recursive: true }) } catch {}
}

function genKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const key = searchParams.get('key')

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  await ensureDir()
  try {
    const data = JSON.parse(await readFile(path.join(SYNC_DIR, `${key}.json`), 'utf-8'))
    return NextResponse.json({ ok: true, ...data })
  } catch {
    return NextResponse.json({ ok: false, error: 'No data found for this key', favorites: [], recent: [], customChannels: [] })
  }
}

export async function POST(req: NextRequest) {
  await ensureDir()
  let body: { key?: string; favorites?: string[]; recent?: string[]; customChannels?: any[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Create new sync key
  if (req.nextUrl.searchParams.get('new') === '1') {
    const key = genKey()
    await writeFile(path.join(SYNC_DIR, `${key}.json`), JSON.stringify({
      favorites: body.favorites || [],
      recent: body.recent || [],
      customChannels: body.customChannels || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, null, 2))
    return NextResponse.json({ ok: true, key })
  }

  // Update existing
  const key = body.key
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  const data = {
    favorites: body.favorites || [],
    recent: body.recent || [],
    customChannels: body.customChannels || [],
    updatedAt: Date.now(),
  }
  await writeFile(path.join(SYNC_DIR, `${key}.json`), JSON.stringify(data, null, 2))

  return NextResponse.json({ ok: true, ...data })
}
