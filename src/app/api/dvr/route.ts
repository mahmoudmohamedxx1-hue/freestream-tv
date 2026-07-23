import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir, unlink, readdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DVR/Recording API — server-side HLS recording.
 *
 * Endpoints:
 *   GET  /api/dvr?list=1              → list all recordings
 *   GET  /api/dvr?id=X                → download/get recording metadata
 *   POST /api/dvr                     → start recording { url, name, channel }
 *   DELETE /api/dvr?id=X              → delete recording
 *
 * Recordings are stored in /home/z/my-project/recordings/
 * Each recording is a .ts file + a .json metadata file.
 */

const RECORDINGS_DIR = '/home/z/my-project/recordings'

async function ensureDir() {
  try { await mkdir(RECORDINGS_DIR, { recursive: true }) } catch {}
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const list = searchParams.get('list')
  const id = searchParams.get('id')
  const download = searchParams.get('download')

  await ensureDir()

  // List recordings
  if (list === '1') {
    try {
      const files = await readdir(RECORDINGS_DIR)
      const recordings: any[] = []
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const meta = JSON.parse(await readFile(path.join(RECORDINGS_DIR, file), 'utf-8'))
            recordings.push(meta)
          } catch {}
        }
      }
      return NextResponse.json({ recordings: recordings.sort((a: any, b: any) => b.startedAt - a.startedAt) })
    } catch {
      return NextResponse.json({ recordings: [] })
    }
  }

  // Download recording
  if (id && download === '1') {
    try {
      const filePath = path.join(RECORDINGS_DIR, `${id}.ts`)
      const buf = await readFile(filePath)
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp2t',
          'Content-Disposition': `attachment; filename="${id}.ts"`,
        },
      })
    } catch {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }
  }

  // Get recording metadata
  if (id) {
    try {
      const meta = JSON.parse(await readFile(path.join(RECORDINGS_DIR, `${id}.json`), 'utf-8'))
      return NextResponse.json(meta)
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'Provide ?list=1 or ?id=X' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  await ensureDir()
  let body: { url?: string; name?: string; channel?: string; duration?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url, name, channel, duration = 3600 } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  const id = `rec-${Date.now()}`
  const startedAt = Date.now()
  const meta = {
    id,
    name: name || channel || 'Recording',
    channel: channel || '',
    url: url.substring(0, 200),
    file: `${id}.ts`,
    startedAt,
    duration, // seconds to record
    status: 'recording',
  }

  // Save metadata
  await writeFile(path.join(RECORDINGS_DIR, `${id}.json`), JSON.stringify(meta, null, 2))

  // Start recording in the background (don't await)
  ;(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), duration * 1000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FreeStreamTV-DVR)' },
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const chunks: Buffer[] = []
      for await (const chunk of res.body as any) {
        chunks.push(Buffer.from(chunk))
      }
      await writeFile(path.join(RECORDINGS_DIR, `${id}.ts`), Buffer.concat(chunks))

      // Update metadata
      const updated = {
        ...meta,
        status: 'completed',
        size: Buffer.concat(chunks).length,
        endedAt: Date.now(),
      }
      await writeFile(path.join(RECORDINGS_DIR, `${id}.json`), JSON.stringify(updated, null, 2))
    } catch (err: any) {
      const updated = { ...meta, status: 'error', error: err.message, endedAt: Date.now() }
      await writeFile(path.join(RECORDINGS_DIR, `${id}.json`), JSON.stringify(updated, null, 2))
    } finally {
      clearTimeout(timeout)
    }
  })()

  return NextResponse.json({ ok: true, id, message: 'Recording started', meta })
}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await ensureDir()
  try {
    await unlink(path.join(RECORDINGS_DIR, `${id}.json`))
    await unlink(path.join(RECORDINGS_DIR, `${id}.ts`)).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
