import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { liveBrowserCount } from '@/lib/browser';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getDb();
    return NextResponse.json({
      ok: true,
      role: process.env.SCRAPER_WORKER_ROLE || 'local',
      persistence: 'sqlite',
      browser_count: liveBrowserCount(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'storage_unavailable' }, { status: 503 });
  }
}
