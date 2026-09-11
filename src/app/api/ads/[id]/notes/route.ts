import { NextRequest, NextResponse } from 'next/server';
import { getAdById, updateAdNotes } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as { notes?: unknown } | null;
  if (typeof body?.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
  }
  if (body.notes.length > 5000) {
    return NextResponse.json({ error: 'notes must be 5000 characters or fewer' }, { status: 400 });
  }
  if (!getAdById(id)) {
    return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
  }

  const notes = body.notes.trim();
  updateAdNotes(id, notes);
  return NextResponse.json({ ok: true, notes });
}
