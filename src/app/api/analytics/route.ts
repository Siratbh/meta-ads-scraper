import { NextRequest, NextResponse } from 'next/server';
import { getPerformance } from '@/lib/performance';
import type { AnalyticsGranularity, AnalyticsPreset } from '@/types/performance';

export const dynamic = 'force-dynamic';

const PRESETS: AnalyticsPreset[] = ['today', 'last_7d', 'this_month', 'last_30d', 'last_90d', 'custom'];
const GRANULARITIES: AnalyticsGranularity[] = ['daily', 'weekly', 'monthly'];

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('preset') ?? 'last_30d';
  if (!PRESETS.includes(requested as AnalyticsPreset)) {
    return NextResponse.json({ status: 'error', message: 'Unsupported performance date range.' }, { status: 400 });
  }
  const preset = requested as AnalyticsPreset;
  const since = req.nextUrl.searchParams.get('since');
  const until = req.nextUrl.searchParams.get('until');
  if (preset === 'custom' && (!isValidDate(since) || !isValidDate(until) || since > until)) {
    return NextResponse.json({ status: 'error', message: 'Custom ranges need valid dates in chronological order.' }, { status: 400 });
  }
  const requestedGranularity = req.nextUrl.searchParams.get('granularity') ?? 'daily';
  if (!GRANULARITIES.includes(requestedGranularity as AnalyticsGranularity)) {
    return NextResponse.json({ status: 'error', message: 'Unsupported chart breakdown.' }, { status: 400 });
  }
  const campaignParam = req.nextUrl.searchParams.get('campaign_ids');
  const campaignIds = campaignParam
    ? campaignParam.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  if (campaignIds.some((id) => !/^[A-Za-z0-9_-]{1,100}$/.test(id))) {
    return NextResponse.json({ status: 'error', message: 'Invalid campaign selection.' }, { status: 400 });
  }
  const result = await getPerformance({
    preset,
    since: preset === 'custom' ? since ?? undefined : undefined,
    until: preset === 'custom' ? until ?? undefined : undefined,
    granularity: requestedGranularity as AnalyticsGranularity,
    campaign_ids: [...new Set(campaignIds)],
  });
  return NextResponse.json(result, { status: result.status === 'error' ? 502 : 200 });
}
