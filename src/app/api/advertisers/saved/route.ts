import { NextRequest, NextResponse } from 'next/server';
import { deleteSavedAdvertiser, listSavedAdvertisers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listSavedAdvertisers());
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteSavedAdvertiser(String(id));
  return NextResponse.json({ ok: true });
}
