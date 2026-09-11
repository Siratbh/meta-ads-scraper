'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleHelp,
  ChevronDown,
  DollarSign,
  Eye,
  Gauge,
  ListFilter,
  MousePointerClick,
  RefreshCw,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  AnalyticsGranularity,
  AnalyticsPreset,
  AnalyticsResponse,
  PerformanceHealth,
  PerformanceCampaignOption,
  PerformanceRow,
  PerformanceSnapshot,
} from '@/types/performance';

const PRESETS: Array<{ value: AnalyticsPreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

const GRANULARITIES: Array<{ value: AnalyticsGranularity; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: '7-day' },
  { value: 'monthly', label: 'Monthly' },
];

const CHART_COLORS = ['#ef4444', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#fb7185'];

function previewRow(values: Partial<PerformanceRow> & Pick<PerformanceRow, 'id' | 'name'>): PerformanceRow {
  const { id, name, ...rest } = values;
  return {
    id,
    name,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    frequency: 0,
    results: 0,
    result_label: 'Purchases',
    result_type: 'purchase',
    cost_per_result: null,
    revenue: 0,
    roas: null,
    health: 'watch',
    health_reason: 'Relative performance needs more data.',
    ...rest,
  };
}

const PREVIEW_SNAPSHOT: PerformanceSnapshot = {
  account_id: 'act_preview',
  source: 'meta-ads-cli',
  currency: 'USD',
  range: { preset: 'last_30d', label: 'Last 30 days', since: '2026-08-10', until: '2026-09-08', granularity: 'daily' },
  available_campaigns: [
    { id: 'campaign-1', name: 'Evergreen Prospecting', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE' },
    { id: 'campaign-2', name: 'Retargeting 30d', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE' },
    { id: 'campaign-3', name: 'UGC Test Cell', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE' },
    { id: 'campaign-4', name: 'New Market Test', status: 'PAUSED', objective: 'SALES', optimization_goal: 'PURCHASE' },
  ],
  selected_campaign_ids: [],
  summary: {
    spend: 18420.55,
    results: 824,
    cost_per_result: 22.35,
    revenue: 63210.2,
    roas: 3.43,
    impressions: 1420840,
    reach: 694210,
    clicks: 24186,
    ctr: 1.7,
    frequency: 2.05,
    active_campaigns: 4,
    active_ads: 18,
    daily_budget: 780,
    currency: 'USD',
    primary_result_label: 'Purchases',
    primary_result_type: 'purchase',
    mixed_goals: false,
  },
  campaigns: [
    previewRow({
      id: 'campaign-1', name: 'Evergreen Prospecting', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE',
      spend: 9620.25, impressions: 824300, reach: 464000, clicks: 11628, ctr: 1.41, cpc: 0.83, cpm: 11.67, frequency: 1.78,
      results: 342, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 28.13, revenue: 32240.5, roas: 3.35,
      health: 'watch', health_reason: '342 purchases at 28.13 each.',
    }),
    previewRow({
      id: 'campaign-2', name: 'Retargeting 30d', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE',
      spend: 4860.8, impressions: 214200, reach: 102880, clicks: 5812, ctr: 2.71, cpc: 0.84, cpm: 22.69, frequency: 2.08,
      results: 324, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 15.0, revenue: 20840.3, roas: 4.29,
      health: 'strong', health_reason: '324 purchases at 15.00, below the view median.',
    }),
    previewRow({
      id: 'campaign-3', name: 'UGC Test Cell', status: 'ACTIVE', objective: 'SALES', optimization_goal: 'PURCHASE',
      spend: 2820.4, impressions: 198600, reach: 107340, clicks: 3012, ctr: 1.52, cpc: 0.94, cpm: 14.2, frequency: 1.85,
      results: 96, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 29.38, revenue: 6320.4, roas: 2.24,
      health: 'attention', health_reason: '29.38 per purchase, above the view median.',
    }),
    previewRow({
      id: 'campaign-4', name: 'New Market Test', status: 'PAUSED', objective: 'SALES', optimization_goal: 'PURCHASE',
      spend: 1119.1, impressions: 183740, reach: 20000, clicks: 3734, ctr: 2.03, cpc: 0.3, cpm: 6.09, frequency: 9.19,
      results: 62, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 18.05, revenue: 3809, roas: 3.4,
      health: 'watch', health_reason: '62 purchases at 18.05 each.',
    }),
  ],
  creatives: [
    previewRow({ id: 'ad-1', name: 'UGC - Room reveal', campaign_name: 'Retargeting 30d', spend: 1880.4, impressions: 90000, clicks: 3190, ctr: 3.54, results: 151, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 12.45, revenue: 10320, roas: 5.49, health: 'strong', health_reason: 'Strongest cost per purchase in the view.' }),
    previewRow({ id: 'ad-2', name: 'Founder story - 20s', campaign_name: 'Evergreen Prospecting', spend: 3270.2, impressions: 252000, clicks: 4020, ctr: 1.6, results: 126, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 25.95, revenue: 11220, roas: 3.43, health: 'watch', health_reason: '126 purchases at 25.95 each.' }),
    previewRow({ id: 'ad-3', name: 'Offer stack - static', campaign_name: 'Retargeting 30d', spend: 1510.4, impressions: 70200, clicks: 1800, ctr: 2.56, results: 104, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 14.52, revenue: 8210, roas: 5.44, health: 'strong', health_reason: '104 purchases at 14.52 each.' }),
    previewRow({ id: 'ad-4', name: 'Carousel - pain points', campaign_name: 'UGC Test Cell', spend: 2021.2, impressions: 128000, clicks: 1400, ctr: 1.09, results: 42, result_label: 'Purchases', result_type: 'purchase', cost_per_result: 48.12, revenue: 2900, roas: 1.43, health: 'attention', health_reason: '48.12 per purchase, above the view median.' }),
  ],
  trend: [
    { date: '2026-09-02', spend: 2120, results: 92, cost_per_result: 23.04 },
    { date: '2026-09-03', spend: 2390, results: 104, cost_per_result: 22.98 },
    { date: '2026-09-04', spend: 2500, results: 118, cost_per_result: 21.19 },
    { date: '2026-09-05', spend: 2740, results: 126, cost_per_result: 21.75 },
    { date: '2026-09-06', spend: 2830, results: 137, cost_per_result: 20.66 },
    { date: '2026-09-07', spend: 2920, results: 139, cost_per_result: 21.01 },
    { date: '2026-09-08', spend: 2920.55, results: 108, cost_per_result: 27.04 },
  ],
  spend_by_campaign: [
    { name: 'Evergreen Prospecting', spend: 9620.25, share: 0.522 },
    { name: 'Retargeting 30d', spend: 4860.8, share: 0.264 },
    { name: 'UGC Test Cell', spend: 2820.4, share: 0.153 },
    { name: 'New Market Test', spend: 1119.1, share: 0.061 },
  ],
  spend_leader: null,
  best_campaign: null,
  attention_campaign: null,
  fetched_at: '2026-09-08T04:00:00.000Z',
};

function formatCurrency(value: number | null | undefined, currency: string, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: digits }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
  }
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
}

function shortName(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultCustomRange(): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);
  since.setDate(since.getDate() - 29);
  return { since: dateInputValue(since), until: dateInputValue(until) };
}

function granularityLabel(value: AnalyticsGranularity): string {
  return GRANULARITIES.find((option) => option.value === value)?.label ?? 'Daily';
}

function readableGoal(row: PerformanceRow): string {
  const goal = row.optimization_goal || row.objective;
  if (!goal || goal === 'MIXED') return row.result_label || 'Primary outcomes';
  if (row.results > 0 && row.result_label) return row.result_label;
  return goal
    .replace(/^OFFSITE_CONVERSIONS$/, 'Offsite conversions')
    .replace(/^LEAD_GENERATION$/, 'Leads')
    .replace(/^LINK_CLICKS$/, 'Link clicks')
    .replace(/^LANDING_PAGE_VIEWS$/, 'Landing page views')
    .replace(/^MESSAGES$/, 'Conversations')
    .replace(/^APP_INSTALLS$/, 'App installs')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function healthMeta(health: PerformanceHealth): { label: string; className: string; Icon: LucideIcon } {
  if (health === 'strong') return { label: 'Strong', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400', Icon: CheckCircle2 };
  if (health === 'attention') return { label: 'Review', className: 'border-red-500/25 bg-red-500/10 text-red-300', Icon: AlertTriangle };
  return { label: 'Watch', className: 'border-amber-500/25 bg-amber-500/10 text-amber-300', Icon: CircleHelp };
}

function HealthBadge({ health }: { health: PerformanceHealth }) {
  const meta = healthMeta(health);
  return (
    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
      <meta.Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card className="rounded-lg border-border/60 bg-card/80">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accent}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function DecisionCard({
  eyebrow,
  row,
  icon: Icon,
  accent,
  empty,
  currency,
}: {
  eyebrow: string;
  row: PerformanceRow | null;
  icon: LucideIcon;
  accent: string;
  empty: string;
  currency: string;
}) {
  return (
    <Card className="rounded-lg border-border/60 bg-card/80">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${accent}`} />
          {eyebrow}
        </div>
        {row ? (
          <>
            <p className="mt-3 truncate font-medium" title={row.name}>{row.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.health_reason}</p>
            <div className="mt-3 flex items-center gap-3 text-xs tabular-nums">
              <span>{formatCurrency(row.spend, currency, 0)} spend</span>
              <span className="text-muted-foreground">{formatNumber(row.results)} {row.result_label.toLowerCase()}</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function SetupState({ message, onRetry, onPreview }: { message: string; onRetry: () => void; onPreview: () => void }) {
  return (
    <Card className="rounded-lg border-dashed border-border/80 bg-card/50">
      <CardContent className="flex flex-col items-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">Connect your Meta ad account</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <code className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-muted-foreground">ACCESS_TOKEN</code>
          <code className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-muted-foreground">AD_ACCOUNT_ID</code>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={onRetry} className="h-8 text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check connection
          </Button>
          <Button variant="secondary" onClick={onPreview} className="h-8 text-xs">
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignFilter({
  campaigns,
  selectedIds,
  onChange,
}: {
  campaigns: PerformanceCampaignOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(selectedIds);
  const label = selectedIds.length === 0 ? 'All campaigns' : `${selectedIds.length} campaign${selectedIds.length === 1 ? '' : 's'}`;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-popover p-2.5 text-popover-foreground shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-1 pb-2">
          <span className="text-xs font-medium">Filter campaigns</span>
          <button type="button" onClick={() => onChange([])} disabled={selectedIds.length === 0} className="text-[11px] text-primary disabled:opacity-40">Clear</button>
        </div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto pt-2">
          {campaigns.map((campaign) => (
            <label key={campaign.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-2 hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.has(campaign.id)}
                onChange={() => toggle(campaign.id)}
                className="mt-0.5 h-3.5 w-3.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block truncate text-xs" title={campaign.name}>{campaign.name}</span>
                <span className="block text-[10px] text-muted-foreground">{campaign.status === 'ACTIVE' ? 'Active' : campaign.status || 'Status unavailable'}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="px-1 pt-2 text-[10px] leading-relaxed text-muted-foreground">Every total and chart will use only the selected campaigns.</p>
      </div>
    </details>
  );
}

export function PerformanceDashboard() {
  const [preset, setPreset] = useState<AnalyticsPreset>('last_30d');
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('daily');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const customRangeReady = preset !== 'custom' || Boolean(since && until);
  const campaignKey = selectedCampaignIds.join(',');
  const query = useQuery<AnalyticsResponse>({
    queryKey: ['performance', preset, since, until, granularity, campaignKey],
    enabled: customRangeReady,
    queryFn: async () => {
      const params = new URLSearchParams({ preset, granularity });
      if (preset === 'custom') {
        params.set('since', since);
        params.set('until', until);
      }
      if (selectedCampaignIds.length > 0) params.set('campaign_ids', selectedCampaignIds.join(','));
      const response = await fetch(`/api/analytics?${params.toString()}`);
      const payload = await response.json() as AnalyticsResponse;
      if (!response.ok && payload.status === 'error') throw new Error(payload.message || 'Performance data could not be loaded.');
      return payload;
    },
    staleTime: 5 * 60 * 1000,
  });

  const snapshot = preview ? PREVIEW_SNAPSHOT : query.data?.data;
  const summary = snapshot?.summary;
  const campaignRows = useMemo(() => snapshot?.campaigns ?? [], [snapshot]);
  const creativeRows = snapshot?.creatives ?? [];
  const trend = snapshot?.trend ?? [];
  const currency = snapshot?.currency ?? 'USD';
  const availableCampaigns = snapshot?.available_campaigns ?? [];
  const displayGranularity = preview ? granularity : snapshot?.range.granularity ?? granularity;
  const displayRange = preview && preset === 'custom' && since && until
    ? `${since} to ${until}`
    : snapshot?.range.label ?? PRESETS.find((option) => option.value === preset)?.label ?? 'Selected range';

  const bestCampaign = snapshot?.best_campaign ?? [...campaignRows].filter((row) => row.cost_per_result != null).sort((a, b) => (a.cost_per_result ?? Infinity) - (b.cost_per_result ?? Infinity))[0] ?? null;
  const attentionCampaign = snapshot?.attention_campaign ?? campaignRows.find((row) => row.health === 'attention') ?? null;
  const spendLeader = snapshot?.spend_leader ?? [...campaignRows].sort((a, b) => b.spend - a.spend)[0] ?? null;
  const chartCampaigns = useMemo(() => (snapshot?.spend_by_campaign ?? []).slice(0, 6), [snapshot]);
  const costChart = useMemo(() => campaignRows.filter((row) => row.spend > 0).slice(0, 8).map((row) => ({
    name: shortName(row.name, 19),
    cost: row.cost_per_result ?? 0,
    hasResult: row.cost_per_result != null,
  })), [campaignRows]);
  const funnel = summary ? [
    { label: 'Impressions', value: summary.impressions, color: '#38bdf8' },
    { label: 'Clicks', value: summary.clicks, color: '#a78bfa' },
    { label: summary.primary_result_label, value: summary.results, color: '#34d399' },
  ] : [];
  const maxFunnel = Math.max(1, ...funnel.map((item) => item.value));

  function retry() {
    setPreview(false);
    void query.refetch();
  }

  function changePreset(value: AnalyticsPreset) {
    setPreset(value);
    setPreview(false);
    if (value === 'custom' && (!since || !until)) {
      const defaults = defaultCustomRange();
      setSince(defaults.since);
      setUntil(defaults.until);
    }
  }

  function changeGranularity(value: AnalyticsGranularity) {
    setGranularity(value);
    setPreview(false);
  }

  function changeCustomDate(field: 'since' | 'until', value: string) {
    setPreset('custom');
    setPreview(false);
    if (field === 'since') setSince(value);
    else setUntil(value);
  }

  if (!preview && query.isLoading) return <div className="p-4 sm:p-6"><LoadingDashboard /></div>;

  if (!snapshot) {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <DashboardHeader
          preset={preset}
          onPresetChange={changePreset}
          since={since}
          until={until}
          onCustomDateChange={changeCustomDate}
          granularity={granularity}
          onGranularityChange={changeGranularity}
          campaigns={availableCampaigns}
          selectedCampaignIds={selectedCampaignIds}
          onCampaignsChange={(ids) => { setSelectedCampaignIds(ids); setPreview(false); }}
          onRefresh={retry}
          refreshing={query.isFetching}
          preview={false}
          onLive={() => setPreview(false)}
        />
        <SetupState
          message={query.data?.message || query.error?.message || 'The dashboard uses the official Meta Ads CLI in read-only mode. Add the account credentials to the server environment, then check the connection.'}
          onRetry={retry}
          onPreview={() => setPreview(true)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <DashboardHeader
        preset={preset}
        onPresetChange={changePreset}
        since={since}
        until={until}
        onCustomDateChange={changeCustomDate}
        granularity={granularity}
        onGranularityChange={changeGranularity}
        campaigns={availableCampaigns}
        selectedCampaignIds={selectedCampaignIds}
        onCampaignsChange={(ids) => { setSelectedCampaignIds(ids); setPreview(false); }}
        onRefresh={() => void query.refetch()}
        refreshing={!preview && query.isFetching}
        preview={preview}
        onLive={() => setPreview(false)}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={preview ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${preview ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {preview ? 'Preview data' : 'Live read-only data'}
        </Badge>
        <span>{displayRange}</span>
        <span>{granularityLabel(displayGranularity)} breakdown</span>
        <span className="text-border">|</span>
        <span>Account {snapshot.account_id}</span>
        {summary?.mixed_goals && <span className="text-amber-300">Campaign goals differ; compare cost per outcome within each goal.</span>}
      </div>

      {summary && (
        <>
          <section aria-label="Performance summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Spend" value={formatCurrency(summary.spend, currency, 0)} detail={`${formatCurrency(summary.daily_budget, currency, 0)} combined daily budget`} icon={DollarSign} accent="bg-red-500/10 text-red-300" />
            <MetricCard label={summary.primary_result_label} value={formatNumber(summary.results)} detail={summary.mixed_goals ? 'Across mixed campaign goals' : 'Primary conversion event'} icon={Target} accent="bg-emerald-500/10 text-emerald-300" />
            <MetricCard label="Cost per outcome" value={formatCurrency(summary.cost_per_result, currency, 2)} detail={summary.cost_per_result == null ? 'Shown per campaign below' : 'Blended for this view'} icon={Gauge} accent="bg-amber-500/10 text-amber-300" />
            <MetricCard label="ROAS" value={summary.roas == null ? '—' : `${summary.roas.toFixed(2)}x`} detail={summary.revenue > 0 ? `${formatCurrency(summary.revenue, currency, 0)} attributed revenue` : 'Purchase value not returned'} icon={Activity} accent="bg-sky-500/10 text-sky-300" />
          </section>

          <section aria-label="Supporting metrics" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/50 py-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-sky-400" /> {formatNumber(summary.impressions)} impressions</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-violet-400" /> {formatNumber(summary.reach)} reached</span>
            <span className="inline-flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5 text-amber-400" /> {formatNumber(summary.clicks)} clicks</span>
            <span className="tabular-nums">{formatPercent(summary.ctr)} CTR</span>
            <span className="tabular-nums">{summary.frequency.toFixed(2)} frequency</span>
            <span>{summary.active_campaigns} active campaigns</span>
          </section>

          <section aria-label="Decision readout" className="grid gap-3 lg:grid-cols-3">
            <DecisionCard eyebrow="Best cost per outcome" row={bestCampaign} icon={Trophy} accent="text-emerald-400" empty="No campaign has a measurable primary outcome yet." currency={currency} />
            <DecisionCard eyebrow="Largest investment" row={spendLeader} icon={DollarSign} accent="text-sky-400" empty="No spend returned for this period." currency={currency} />
            <DecisionCard eyebrow="Needs review" row={attentionCampaign} icon={AlertTriangle} accent="text-amber-400" empty="No campaign is currently flagged for review." currency={currency} />
          </section>

          <section aria-label="Performance charts" className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
            <Card className="min-w-0 rounded-lg border-border/60 bg-card/80">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/50 pb-3">
                <div>
                  <CardTitle className="text-sm">Spend and outcomes</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{granularityLabel(displayGranularity)} investment against the campaign conversion event</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Spend</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Outcomes</span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {trend.length > 0 ? (
                  <div className="h-64 min-h-[256px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value: string) => value.slice(5)} />
                        <YAxis yAxisId="spend" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCurrency(value, currency, 0)} />
                        <YAxis yAxisId="results" orientation="right" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: '#171717', border: '1px solid #3a3a3a', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fafafa' }} />
                        <Area yAxisId="spend" type="monotone" dataKey="spend" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} strokeWidth={2} />
                        <Line yAxisId="results" type="monotone" dataKey="results" stroke="#34d399" strokeWidth={2.5} dot={{ r: 2, fill: '#34d399', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmpty label={`${granularityLabel(displayGranularity)} insight rows were not returned for this range.`} />
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-lg border-border/60 bg-card/80">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-sm">Where the budget goes</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Spend share by campaign</p>
              </CardHeader>
              <CardContent className="p-4">
                {chartCampaigns.length > 0 ? (
                  <div className="grid grid-cols-[minmax(130px,1fr)_minmax(0,1fr)] items-center gap-2">
                    <div className="h-48 min-h-[192px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie data={chartCampaigns} dataKey="spend" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="none">
                            {chartCampaigns.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#171717', border: '1px solid #3a3a3a', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="min-w-0 space-y-2.5">
                      {chartCampaigns.map((campaign, index) => (
                        <div key={campaign.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="min-w-0 flex-1 truncate" title={campaign.name}>{campaign.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(campaign.share * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ChartEmpty label="No campaign spend returned for this range." />
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-label="Conversion funnel" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card className="rounded-lg border-border/60 bg-card/80">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-sm">Conversion path</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">The volume that moves from attention to action</p>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {funnel.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium tabular-nums">{formatNumber(item.value)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, item.value / maxFunnel * 100)}%`, background: item.color }} />
                    </div>
                  </div>
                ))}
                {summary.mixed_goals && <p className="pt-1 text-[11px] leading-relaxed text-amber-300/80">Outcomes are summed for orientation only. The campaign table is the source of truth when goals differ.</p>}
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-lg border-border/60 bg-card/80">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="text-sm">Cost per outcome</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Lower is better within the same conversion goal</p>
              </CardHeader>
              <CardContent className="p-4">
                {costChart.length > 0 ? (
                  <div className="h-56 min-h-[224px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={costChart} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
                        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#a3a3a3', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCurrency(value, currency, 0)} />
                        <YAxis type="category" dataKey="name" width={116} tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: '#171717', border: '1px solid #3a3a3a', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                          {costChart.map((entry) => <Cell key={entry.name} fill={entry.hasResult ? '#ef4444' : '#525252'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmpty label="Campaign cost data will appear after the first insight sync." />
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-label="Campaign performance">
            <Card className="rounded-lg border-border/60 bg-card/80">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/50 pb-3">
                <div>
                  <CardTitle className="text-sm">Campaign performance</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Ranked by spend. Health is relative to comparable campaigns in this view.</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{campaignRows.length} campaigns</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead className="border-b border-border/50 bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Campaign</th>
                        <th className="px-3 py-3 font-medium">Goal</th>
                        <th className="px-3 py-3 text-right font-medium">Spend</th>
                        <th className="px-3 py-3 text-right font-medium">Outcomes</th>
                        <th className="px-3 py-3 text-right font-medium">Cost / outcome</th>
                        <th className="px-3 py-3 text-right font-medium">ROAS</th>
                        <th className="px-4 py-3 text-right font-medium">Read</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {campaignRows.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-muted/20">
                          <td className="max-w-[280px] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${row.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                              <span className="truncate font-medium" title={row.name}>{row.name}</span>
                            </div>
                            <p className="mt-1 truncate pl-4 text-[11px] text-muted-foreground">{row.health_reason}</p>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{readableGoal(row)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.spend, currency, 0)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.results)} <span className="text-muted-foreground">{row.result_label.toLowerCase()}</span></td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.cost_per_result, currency, 2)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.roas == null ? '—' : `${row.roas.toFixed(2)}x`}</td>
                          <td className="px-4 py-3 text-right"><HealthBadge health={row.health} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {campaignRows.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No campaign insight rows were returned for this range.</div>}
              </CardContent>
            </Card>
          </section>

          <section aria-label="Creative performance">
            <Card className="rounded-lg border-border/60 bg-card/80">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/50 pb-3">
                <div>
                  <CardTitle className="text-sm">Creative leaders</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Ads creating the most efficient conversion signal</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">Top {Math.min(creativeRows.length, 5)}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {creativeRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="border-b border-border/50 bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Ad</th>
                          <th className="px-3 py-3 font-medium">Campaign</th>
                          <th className="px-3 py-3 text-right font-medium">Spend</th>
                          <th className="px-3 py-3 text-right font-medium">Outcomes</th>
                          <th className="px-3 py-3 text-right font-medium">Cost / outcome</th>
                          <th className="px-4 py-3 text-right font-medium">Read</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {creativeRows.slice(0, 5).map((row) => (
                          <tr key={row.id} className="hover:bg-muted/20">
                            <td className="max-w-[260px] px-4 py-3"><span className="block truncate font-medium" title={row.name}>{row.name}</span></td>
                            <td className="max-w-[190px] px-3 py-3"><span className="block truncate text-muted-foreground" title={row.campaign_name}>{row.campaign_name || '—'}</span></td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.spend, currency, 0)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.results)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(row.cost_per_result, currency, 2)}</td>
                            <td className="px-4 py-3 text-right"><HealthBadge health={row.health} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">Ad-level insight rows are not available for this connection yet.</div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function DashboardHeader({
  preset,
  onPresetChange,
  since,
  until,
  onCustomDateChange,
  granularity,
  onGranularityChange,
  campaigns,
  selectedCampaignIds,
  onCampaignsChange,
  onRefresh,
  refreshing,
  preview,
  onLive,
}: {
  preset: AnalyticsPreset;
  onPresetChange: (value: AnalyticsPreset) => void;
  since: string;
  until: string;
  onCustomDateChange: (field: 'since' | 'until', value: string) => void;
  granularity: AnalyticsGranularity;
  onGranularityChange: (value: AnalyticsGranularity) => void;
  campaigns: PerformanceCampaignOption[];
  selectedCampaignIds: string[];
  onCampaignsChange: (ids: string[]) => void;
  onRefresh: () => void;
  refreshing: boolean;
  preview: boolean;
  onLive: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
          <BarChart3 className="h-3.5 w-3.5" /> Performance
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Account overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find where money is moving, what is converting, and what needs a closer look.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {preview && <Button variant="ghost" onClick={onLive} className="h-8 text-xs">Back to live</Button>}
        <select
          aria-label="Performance date range"
          value={preset}
          onChange={(event) => onPresetChange(event.target.value as AnalyticsPreset)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {preset === 'custom' && (
          <>
            <input
              type="date"
              aria-label="Custom range start"
              value={since}
              onChange={(event) => onCustomDateChange('since', event.target.value)}
              className="h-8 w-[8.5rem] rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="Custom range end"
              value={until}
              onChange={(event) => onCustomDateChange('until', event.target.value)}
              className="h-8 w-[8.5rem] rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </>
        )}
        <select
          aria-label="Performance chart breakdown"
          value={granularity}
          onChange={(event) => onGranularityChange(event.target.value as AnalyticsGranularity)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {GRANULARITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {campaigns.length > 0 && <CampaignFilter campaigns={campaigns} selectedIds={selectedCampaignIds} onChange={onCampaignsChange} />}
        <Button variant="outline" onClick={onRefresh} disabled={refreshing || preview} className="h-8 text-xs">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-56 min-h-[224px] items-center justify-center text-center text-xs text-muted-foreground">{label}</div>
  );
}
