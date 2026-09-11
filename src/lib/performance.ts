import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AnalyticsGranularity,
  AnalyticsPreset,
  AnalyticsQuery,
  AnalyticsRange,
  AnalyticsResponse,
  PerformanceHealth,
  PerformanceCampaignOption,
  PerformanceRow,
  PerformanceSnapshot,
  TrendPoint,
} from '@/types/performance';

const execFile = promisify(execFileCallback);
const CLI_TIMEOUT_MS = 90_000;
const MAX_BUFFER = 16 * 1024 * 1024;
const META_API_VERSION = process.env.META_API_VERSION || 'v26.0';
const INSIGHT_FIELDS = [
  'date_start',
  'date_stop',
  'account_currency',
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'spend',
  'impressions',
  'reach',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'frequency',
  'actions',
  'cost_per_action_type',
  'action_values',
  'purchase_roas',
].join(',');

type RawRow = Record<string, unknown>;

interface CliConfig {
  accountId: string;
  token: string;
}

interface ActionValue {
  action_type: string;
  value: number;
}

interface Aggregate {
  id: string;
  name: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctrWeighted: number;
  cpcWeighted: number;
  cpmWeighted: number;
  frequencyWeighted: number;
  weight: number;
  actions: Map<string, number>;
  actionValues: Map<string, number>;
  purchaseRoasWeighted: number;
  metadata: RawRow;
}

const PRESET_LABELS: Record<AnalyticsPreset, string> = {
  today: 'Today',
  last_7d: 'Last 7 days',
  this_month: 'This month',
  last_30d: 'Last 30 days',
  last_90d: 'Last 90 days',
  custom: 'Custom range',
};

const PRESET_DAYS: Partial<Record<AnalyticsPreset, number>> = {
  today: 1,
  last_7d: 7,
  last_30d: 30,
  last_90d: 90,
};

const GOAL_ACTIONS: Record<string, string[]> = {
  SALES: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'],
  PURCHASE: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'],
  OFFSITE_CONVERSIONS: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'complete_registration'],
  LEADS: ['lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped'],
  LEAD_GENERATION: ['lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped'],
  CONVERSATIONS: ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'conversation_started'],
  LINK_CLICKS: ['link_click'],
  LANDING_PAGE_VIEWS: ['landing_page_view'],
  TRAFFIC: ['link_click', 'landing_page_view'],
  MESSAGES: ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'conversation_started'],
  ENGAGEMENT: ['post_engagement', 'page_engagement'],
  APP_INSTALLS: ['mobile_app_install', 'app_install'],
  COMPLETE_REGISTRATION: ['complete_registration'],
  ADD_TO_CART: ['add_to_cart'],
  CONTENT_VIEWS: ['view_content'],
};

const ACTION_LABELS: Array<[string, string]> = [
  ['offsite_conversion.fb_pixel_purchase', 'Purchases'],
  ['omni_purchase', 'Purchases'],
  ['purchase', 'Purchases'],
  ['leadgen_grouped', 'Leads'],
  ['onsite_conversion.lead_grouped', 'Leads'],
  ['lead', 'Leads'],
  ['landing_page_view', 'Landing page views'],
  ['link_click', 'Link clicks'],
  ['messaging_conversation_started_7d', 'Conversations'],
  ['conversation_started', 'Conversations'],
  ['mobile_app_install', 'App installs'],
  ['app_install', 'App installs'],
  ['complete_registration', 'Registrations'],
  ['add_to_cart', 'Add to carts'],
  ['view_content', 'Content views'],
  ['post_engagement', 'Engagements'],
  ['page_engagement', 'Engagements'],
];

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asRows(payload: unknown): RawRow[] {
  if (Array.isArray(payload)) return payload.filter((row): row is RawRow => !!row && typeof row === 'object');
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data.filter((row): row is RawRow => !!row && typeof row === 'object');
  return [];
}

function parseJson(stdout: string): unknown {
  const cleaned = stdout.replace(/^for \(;;\);/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = Math.min(...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((index) => index >= 0));
    if (Number.isFinite(start)) return JSON.parse(cleaned.slice(start));
    throw new Error('Meta Ads CLI returned invalid JSON.');
  }
}

function parseDotEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const allowed = new Set([
    'ACCESS_TOKEN',
    'AD_ACCOUNT_ID',
    'BUSINESS_ID',
    'META_SYSTEM_USER_ACCESS_TOKEN',
    'META_AD_ACCOUNT',
  ]);
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match || !allowed.has(match[1])) continue;
    const raw = match[2].trim();
    values[match[1]] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function resolveConfig(): CliConfig | null {
  const kitDir = process.env.META_KIT_DIR?.trim();
  const kitEnv = kitDir ? parseDotEnv(path.join(kitDir, '.env')) : {};
  const accountId =
    process.env.META_AD_ACCOUNT_ID ||
    process.env.AD_ACCOUNT_ID ||
    process.env.META_AD_ACCOUNT ||
    kitEnv.AD_ACCOUNT_ID ||
    kitEnv.META_AD_ACCOUNT ||
    '';
  const token =
    process.env.META_ACCESS_TOKEN ||
    process.env.ACCESS_TOKEN ||
    process.env.META_SYSTEM_USER_ACCESS_TOKEN ||
    kitEnv.ACCESS_TOKEN ||
    kitEnv.META_SYSTEM_USER_ACCESS_TOKEN ||
    '';
  if (!accountId || !token) return null;
  return { accountId: accountId.startsWith('act_') ? accountId : `act_${accountId}`, token };
}

async function runBinary(binary: string, args: string[], env: NodeJS.ProcessEnv): Promise<unknown> {
  const { stdout } = await execFile(binary, args, {
    env,
    timeout: CLI_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
  return parseJson(stdout);
}

async function runMeta(args: string[], config: CliConfig): Promise<unknown> {
  const env = {
    ...process.env,
    ACCESS_TOKEN: config.token,
    AD_ACCOUNT_ID: config.accountId,
  };
  const cliArgs = ['--output', 'json', '--no-input', ...args];
  try {
    return await runBinary('meta', cliArgs, env);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('Meta Ads CLI could not return read-only data. Check the token, account ID, and read permissions.');
    }
  }
  try {
    return await runBinary('uvx', ['--python', '3.12', '--from', 'meta-ads', 'meta', ...cliArgs], env);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      const stderr = typeof (error as { stderr?: unknown }).stderr === 'string' ? (error as { stderr: string }).stderr : '';
      if (/request limit/i.test(stderr)) throw new Error('Meta Ads request limit reached. Wait a moment and retry.');
      throw new Error('Meta Ads CLI could not return read-only data. Check the token, account ID, and read permissions.');
    }
    throw new Error('Meta Ads CLI is unavailable. Install meta-ads or make uvx available to the server.');
  }
}

function getText(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function getId(row: RawRow, level: 'campaign' | 'adset' | 'ad'): string {
  return getText(row, `${level}_id`, 'id') || `${level}-unknown`;
}

function getName(row: RawRow, level: 'campaign' | 'adset' | 'ad'): string {
  return getText(row, `${level}_name`, 'name') || 'Unnamed';
}

function actionList(value: unknown): ActionValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      action_type: getText(entry, 'action_type'),
      value: asNumber(entry.value),
    }))
    .filter((entry) => entry.action_type);
}

function actionMap(rows: RawRow[], key: 'actions' | 'action_values'): Map<string, number> {
  const output = new Map<string, number>();
  for (const row of rows) {
    for (const action of actionList(row[key])) {
      output.set(action.action_type, (output.get(action.action_type) ?? 0) + action.value);
    }
  }
  return output;
}

function purchaseValue(values: Map<string, number>): number {
  for (const [key, value] of values) {
    if (/purchase/i.test(key)) return value;
  }
  return 0;
}

function purchaseRoas(rows: RawRow[], spend: number): number {
  let weighted = 0;
  let weight = 0;
  for (const row of rows) {
    const rowSpend = asNumber(row.spend);
    const roas = actionList(row.purchase_roas)[0]?.value ?? asNumber(row.purchase_roas);
    if (roas > 0 && rowSpend > 0) {
      weighted += roas * rowSpend;
      weight += rowSpend;
    }
  }
  return weight > 0 ? weighted / weight : spend > 0 ? purchaseValue(actionMap(rows, 'action_values')) / spend : 0;
}

function normalizeActionType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '_');
}

function actionMatches(actionType: string, candidate: string): boolean {
  const actual = normalizeActionType(actionType);
  const expected = normalizeActionType(candidate);
  return actual === expected || actual.endsWith(`.${expected}`) || actual.includes(expected);
}

function goalKey(goal?: string): string {
  return (goal ?? '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

function resultLabel(actionType: string, goal?: string): string {
  const lower = normalizeActionType(actionType);
  const match = ACTION_LABELS.find(([key]) => lower === normalizeActionType(key) || lower.includes(normalizeActionType(key)));
  if (match) return match[1];
  if (goal) return humanize(goal);
  return actionType ? humanize(actionType) : 'Results';
}

function humanize(value: string): string {
  return value
    .replace(/^offsite_conversion\./i, '')
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function goalLabel(goal?: string): string {
  if (!goal) return 'Primary outcomes';
  const key = goalKey(goal);
  if (key === 'SALES' || key === 'PURCHASE') return 'Purchases';
  if (key === 'OFFSITE_CONVERSIONS') return 'Offsite conversions';
  if (key === 'LEADS' || key === 'LEAD_GENERATION') return 'Leads';
  if (key === 'LINK_CLICKS') return 'Link clicks';
  if (key === 'LANDING_PAGE_VIEWS') return 'Landing page views';
  if (key === 'MESSAGES') return 'Conversations';
  if (key === 'APP_INSTALLS') return 'App installs';
  if (key === 'COMPLETE_REGISTRATION') return 'Registrations';
  if (key === 'ADD_TO_CART') return 'Add to carts';
  return humanize(goal);
}

function resolveResult(actions: Map<string, number>, goal?: string): { type: string; label: string; value: number } {
  const candidates = GOAL_ACTIONS[goalKey(goal)] ?? [];
  for (const candidate of candidates) {
    const match = [...actions.entries()].find(([type]) => actionMatches(type, candidate));
    if (match) return { type: match[0], label: resultLabel(match[0], goal), value: match[1] };
  }
  const fallbackOrder = ['purchase', 'lead', 'complete_registration', 'add_to_cart', 'landing_page_view', 'link_click', 'mobile_app_install', 'post_engagement', 'page_engagement'];
  for (const candidate of fallbackOrder) {
    const match = [...actions.entries()].find(([type]) => actionMatches(type, candidate));
    if (match) return { type: match[0], label: resultLabel(match[0], goal), value: match[1] };
  }
  const first = [...actions.entries()].sort((a, b) => b[1] - a[1])[0];
  return first
    ? { type: first[0], label: resultLabel(first[0], goal), value: first[1] }
    : { type: goal ?? 'primary_outcome', label: goalLabel(goal), value: 0 };
}

function aggregateRows(rows: RawRow[], level: 'campaign' | 'ad', metadata: RawRow): Aggregate[] {
  const groups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const key = getId(row, level) || getName(row, level);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([id, bucket]) => {
    const first = bucket[0] ?? {};
    const spend = bucket.reduce((sum, row) => sum + asNumber(row.spend), 0);
    const weight = Math.max(spend, 1);
    const weighted = (key: string) => bucket.reduce((sum, row) => sum + asNumber(row[key]) * Math.max(asNumber(row.spend), 1), 0) / weight;
    return {
      id,
      name: getName(first, level),
      campaignId: getText(first, 'campaign_id'),
      campaignName: getText(first, 'campaign_name'),
      adsetId: getText(first, 'adset_id'),
      adsetName: getText(first, 'adset_name'),
      spend,
      impressions: bucket.reduce((sum, row) => sum + asNumber(row.impressions), 0),
      reach: bucket.reduce((sum, row) => sum + asNumber(row.reach), 0),
      clicks: bucket.reduce((sum, row) => sum + asNumber(row.clicks), 0),
      ctrWeighted: weighted('ctr'),
      cpcWeighted: weighted('cpc'),
      cpmWeighted: weighted('cpm'),
      frequencyWeighted: weighted('frequency'),
      weight,
      actions: actionMap(bucket, 'actions'),
      actionValues: actionMap(bucket, 'action_values'),
      purchaseRoasWeighted: purchaseRoas(bucket, spend),
      metadata: bucket[0] ?? metadata,
    };
  });
}

function performanceRow(
  aggregate: Aggregate,
  goal: string | undefined,
  metadata: RawRow,
  fallbackName?: string,
): PerformanceRow {
  const result = resolveResult(aggregate.actions, goal);
  const revenue = purchaseValue(aggregate.actionValues);
  const roasValue = aggregate.purchaseRoasWeighted || (revenue > 0 && aggregate.spend > 0 ? revenue / aggregate.spend : 0);
  const impressions = aggregate.impressions;
  const reach = aggregate.reach;
  return {
    id: aggregate.id,
    name: aggregate.name === 'Unnamed' ? fallbackName || aggregate.name : aggregate.name,
    campaign_id: aggregate.campaignId || getText(metadata, 'campaign_id') || undefined,
    campaign_name: aggregate.campaignName || getText(metadata, 'campaign_name') || undefined,
    adset_id: aggregate.adsetId || getText(metadata, 'adset_id') || undefined,
    adset_name: aggregate.adsetName || getText(metadata, 'adset_name') || undefined,
    status: getText(metadata, 'effective_status', 'status', 'configured_status') || undefined,
    objective: getText(metadata, 'objective') || undefined,
    optimization_goal: goal,
    spend: aggregate.spend,
    impressions,
    reach,
    clicks: aggregate.clicks,
    ctr: aggregate.ctrWeighted || (impressions > 0 ? aggregate.clicks / impressions * 100 : 0),
    cpc: aggregate.cpcWeighted || (aggregate.clicks > 0 ? aggregate.spend / aggregate.clicks : 0),
    cpm: aggregate.cpmWeighted || (impressions > 0 ? aggregate.spend / impressions * 1000 : 0),
    frequency: aggregate.frequencyWeighted || (reach > 0 ? impressions / reach : 0),
    results: result.value,
    result_label: result.label,
    result_type: result.type,
    cost_per_result: result.value > 0 ? aggregate.spend / result.value : null,
    revenue,
    roas: roasValue > 0 ? roasValue : null,
    health: 'watch',
    health_reason: 'Relative performance needs more data.',
  };
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value && value !== 'MIXED'))];
}

function metadataById(rows: RawRow[]): Map<string, RawRow> {
  const output = new Map<string, RawRow>();
  for (const row of rows) {
    const id = getText(row, 'id');
    if (id) output.set(id, row);
  }
  return output;
}

function campaignGoal(campaign: RawRow, adsets: RawRow[]): string | undefined {
  const goals = unique(adsets.filter((row) => getText(row, 'campaign_id') === getText(campaign, 'id')).map((row) => getText(row, 'optimization_goal')));
  if (goals.length === 1) return goals[0];
  if (goals.length > 1) return 'MIXED';
  const objective = getText(campaign, 'objective');
  return objective || undefined;
}

function healthRows(rows: PerformanceRow[]): PerformanceRow[] {
  const byResultType = new Map<string, number[]>();
  for (const row of rows) {
    if (row.cost_per_result != null) {
      const values = byResultType.get(row.result_type) ?? [];
      values.push(row.cost_per_result);
      byResultType.set(row.result_type, values);
    }
  }
  for (const values of byResultType.values()) values.sort((a, b) => a - b);
  const median = (values: number[]) => values.length ? values[Math.floor((values.length - 1) / 2)] : 0;
  return rows.map((row) => {
    let health: PerformanceHealth = 'watch';
    let reason = 'Relative performance needs more data.';
    if (row.spend > 0 && row.results === 0) {
      health = 'attention';
      reason = `Spent ${row.spend.toFixed(2)} with no ${row.result_label.toLowerCase()}.`;
    } else if (row.cost_per_result != null) {
      const benchmark = median(byResultType.get(row.result_type) ?? []);
      if (benchmark > 0 && row.cost_per_result <= benchmark * 0.8) {
        health = 'strong';
        reason = `${row.results.toLocaleString()} ${row.result_label.toLowerCase()} at ${row.cost_per_result.toFixed(2)}, below the view median.`;
      } else if (benchmark > 0 && row.cost_per_result > benchmark * 1.5) {
        health = 'attention';
        reason = `${row.cost_per_result.toFixed(2)} per ${row.result_label.toLowerCase().replace(/s$/, '')}, above the view median.`;
      } else {
        reason = `${row.results.toLocaleString()} ${row.result_label.toLowerCase()} at ${row.cost_per_result.toFixed(2)} each.`;
      }
    } else if (row.spend === 0) {
      reason = 'No spend in this period.';
    }
    row.health = health;
    row.health_reason = reason;
    return row;
  });
}

function dateRange(query: AnalyticsQuery): AnalyticsRange {
  const until = new Date();
  const since = new Date(until);
  if (query.preset === 'custom') {
    return {
      preset: query.preset,
      label: `${query.since} to ${query.until}`,
      since: query.since ?? '',
      until: query.until ?? '',
      granularity: query.granularity,
    };
  }
  if (query.preset === 'this_month') since.setUTCDate(1);
  else since.setUTCDate(until.getUTCDate() - ((PRESET_DAYS[query.preset] ?? 1) - 1));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { preset: query.preset, label: PRESET_LABELS[query.preset], since: iso(since), until: iso(until), granularity: query.granularity };
}

function isValidIsoDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function runInsights(
  query: AnalyticsQuery,
  increment: AnalyticsGranularity | 'all_days',
  config: CliConfig,
  entity: { level?: 'account' | 'campaign' | 'ad'; campaignId?: string; adId?: string } = {},
): Promise<unknown> {
  const timeIncrement = increment === 'daily' ? '1' : increment === 'weekly' ? '7' : increment;
  const params = new URLSearchParams({
    access_token: config.token,
    level: entity.level ?? (entity.adId ? 'ad' : entity.campaignId ? 'campaign' : 'account'),
    time_increment: timeIncrement,
    fields: INSIGHT_FIELDS,
    limit: '5000',
  });
  if (query.preset === 'custom') {
    params.set('since', query.since ?? '');
    params.set('until', query.until ?? '');
  } else {
    params.set('date_preset', query.preset);
  }
  if (entity.campaignId) params.set('filtering', JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: entity.campaignId }]));
  if (entity.adId) params.set('filtering', JSON.stringify([{ field: 'ad.id', operator: 'EQUAL', value: entity.adId }]));
  const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${config.accountId}/insights?${params.toString()}`, { cache: 'no-store' });
  const payload = await response.json() as { data?: unknown; error?: { code?: number; message?: string } };
  if (!response.ok || payload.error) {
    if (payload.error?.code === 17 || /request limit/i.test(payload.error?.message ?? '')) {
      throw new Error('Meta Ads request limit reached. Wait a moment and retry.');
    }
    throw new Error(payload.error?.message || 'Meta Ads insights could not be loaded.');
  }
  return payload;
}

function aggregateTrend(rows: RawRow[], goalFor: (row: RawRow) => string | undefined): TrendPoint[] {
  const groups = new Map<string, { spend: number; results: number }>();
  for (const row of rows) {
    const date = getText(row, 'date_start') || 'Unknown';
    const bucket = groups.get(date) ?? { spend: 0, results: 0 };
    bucket.spend += asNumber(row.spend);
    bucket.results += resolveResult(actionMap([row], 'actions'), goalFor(row)).value;
    groups.set(date, bucket);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
    date,
    spend: value.spend,
    results: value.results,
    cost_per_result: value.results > 0 ? value.spend / value.results : null,
  }));
}

function cleanStatus(value: string): string {
  return value.toUpperCase().replace(/_/g, ' ');
}

export async function getPerformance(query: AnalyticsQuery): Promise<AnalyticsResponse> {
  if (query.preset === 'custom' && (!isValidIsoDate(query.since) || !isValidIsoDate(query.until) || query.since > query.until)) {
    return { status: 'error', message: 'Custom ranges need valid dates in chronological order.' };
  }
  const config = resolveConfig();
  if (!config) {
    return {
      status: 'not_configured',
      message: 'Add ACCESS_TOKEN and AD_ACCOUNT_ID to the scraper server environment to load read-only Meta performance data.',
    };
  }

  try {
    const selectedIds = [...new Set(query.campaign_ids ?? [])];
    const selectedSet = new Set(selectedIds);
    const [campaignsPayload, adsetsPayload, adsPayload, accountInsightsPayload] = await Promise.all([
      runMeta(['ads', 'campaign', 'list', '--limit', '500'], config),
      runMeta(['ads', 'adset', 'list', '--limit', '500'], config),
      runMeta(['ads', 'ad', 'list', '--limit', '500'], config),
      runInsights(query, 'all_days', config),
    ]);

    const campaigns = asRows(campaignsPayload);
    const adsets = asRows(adsetsPayload);
    const ads = asRows(adsPayload);
    const accountInsights = asRows(accountInsightsPayload);
    const campaignMap = metadataById(campaigns);
    const adsetMap = metadataById(adsets);
    const adMap = metadataById(ads);
    const campaignGoals = new Map(campaigns.map((campaign) => [getText(campaign, 'id'), campaignGoal(campaign, adsets)]));
    const scopedCampaigns = campaigns.filter((row) => selectedIds.length === 0 || selectedSet.has(getText(row, 'id')));
    const campaignInsightRows = asRows(await runInsights(query, 'all_days', config, { level: 'campaign' }));
    const trendRows = asRows(await runInsights(query, query.granularity, config, { level: 'campaign' }));
    const adInsightRows = asRows(await runInsights(query, 'all_days', config, { level: 'ad' }));
    const isSelected = (row: RawRow) => selectedIds.length === 0 || selectedSet.has(getText(row, 'campaign_id'));
    const scopedAds = ads.filter(isSelected);
    const scopedInsights = campaignInsightRows.filter(isSelected);
    const scopedTrendRows = trendRows.filter(isSelected);
    const scopedGoals = unique(scopedCampaigns.map((campaign) => campaignGoals.get(getText(campaign, 'id'))));
    const fallbackGoal = scopedGoals.length === 1 ? scopedGoals[0] : undefined;
    const availableCampaigns = campaigns.reduce<PerformanceCampaignOption[]>((result, campaign) => {
      const id = getText(campaign, 'id');
      if (!id) return result;
      result.push({
        id,
        name: getName(campaign, 'campaign'),
        ...(getText(campaign, 'effective_status', 'status', 'configured_status') ? { status: getText(campaign, 'effective_status', 'status', 'configured_status') } : {}),
        ...(getText(campaign, 'objective') ? { objective: getText(campaign, 'objective') } : {}),
        ...(campaignGoals.get(id) ? { optimization_goal: campaignGoals.get(id) } : {}),
      });
      return result;
    }, []).sort((a, b) => a.name.localeCompare(b.name));

    const campaignAggregates = aggregateRows(scopedInsights, 'campaign', {});
    const campaignRows = healthRows(campaignAggregates.map((aggregate) => {
      const campaignId = aggregate.id === 'campaign-unknown' ? aggregate.campaignId : aggregate.id;
      const metadata = campaignId ? campaignMap.get(campaignId) ?? {} : {};
      const goal = campaignId ? campaignGoals.get(campaignId) : fallbackGoal;
      return performanceRow(aggregate, goal, metadata, aggregate.campaignName);
    }));

    const adRows = aggregateRows(adInsightRows.filter(isSelected), 'ad', {}).map((aggregate) => {
      const adId = aggregate.id === 'ad-unknown' ? getText(aggregate.metadata, 'ad_id') : aggregate.id;
      const adMetadata = adId ? adMap.get(adId) ?? {} : {};
      const adsetId = aggregate.adsetId || getText(adMetadata, 'adset_id');
      const adsetMetadata = adsetId ? adsetMap.get(adsetId) ?? {} : {};
      const goal = getText(adsetMetadata, 'optimization_goal') || (aggregate.campaignId ? campaignGoals.get(aggregate.campaignId) : fallbackGoal);
      return performanceRow(aggregate, goal, adMetadata, aggregate.name);
    });
    const creatives = healthRows(adRows).sort((a, b) => b.spend - a.spend);
    const range = dateRange(query);
    const totalSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
    const totalResults = campaignRows.reduce((sum, row) => sum + row.results, 0);
    const totalRevenue = campaignRows.reduce((sum, row) => sum + row.revenue, 0);
    const totalImpressions = campaignRows.reduce((sum, row) => sum + row.impressions, 0);
    const totalReach = campaignRows.reduce((sum, row) => sum + row.reach, 0);
    const totalClicks = campaignRows.reduce((sum, row) => sum + row.clicks, 0);
    const goals = unique(campaignRows.map((row) => row.optimization_goal));
    const resultTypes = unique(campaignRows.map((row) => row.result_type));
    const mixedGoals = goals.length > 1 || campaignRows.some((row) => row.optimization_goal === 'MIXED');
    const currency = getText(accountInsights[0] ?? campaignInsightRows[0] ?? {}, 'account_currency', 'currency') || 'USD';
    const activeCampaigns = scopedCampaigns.filter((row) => cleanStatus(getText(row, 'effective_status', 'status')) === 'ACTIVE').length;
    const activeAds = scopedAds.filter((row) => cleanStatus(getText(row, 'effective_status', 'status')) === 'ACTIVE').length;
    const spendLeader = [...campaignRows].sort((a, b) => b.spend - a.spend)[0] ?? null;
    const bestCampaign = [...campaignRows].filter((row) => row.cost_per_result != null).sort((a, b) => (a.cost_per_result ?? Infinity) - (b.cost_per_result ?? Infinity))[0] ?? null;
    const attentionCampaign = campaignRows.find((row) => row.health === 'attention') ?? null;
    const dailyBudget = scopedCampaigns.reduce((sum, row) => sum + asNumber(row.daily_budget), 0);
    const snapshot: PerformanceSnapshot = {
      account_id: config.accountId,
      source: 'meta-ads-cli',
      currency,
      range,
      available_campaigns: availableCampaigns,
      selected_campaign_ids: selectedIds,
      summary: {
        spend: totalSpend,
        results: totalResults,
        cost_per_result: !mixedGoals && totalResults > 0 ? totalSpend / totalResults : null,
        revenue: totalRevenue,
        roas: totalRevenue > 0 && totalSpend > 0 ? totalRevenue / totalSpend : null,
        impressions: totalImpressions,
        reach: totalReach,
        clicks: totalClicks,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0,
        frequency: totalReach > 0 ? totalImpressions / totalReach : 0,
        active_campaigns: activeCampaigns || campaignRows.filter((row) => row.status === 'ACTIVE').length,
        active_ads: activeAds || creatives.filter((row) => row.status === 'ACTIVE').length,
        daily_budget: dailyBudget,
        currency,
        primary_result_label: !mixedGoals && resultTypes.length === 1 ? resultLabel(resultTypes[0], goals[0]) : 'Primary outcomes',
        primary_result_type: !mixedGoals && resultTypes.length === 1 ? resultTypes[0] : 'mixed',
        mixed_goals: mixedGoals,
      },
      campaigns: campaignRows.sort((a, b) => b.spend - a.spend),
      creatives,
      trend: aggregateTrend(scopedTrendRows, (row) => getText(row, 'campaign_id') ? campaignGoals.get(getText(row, 'campaign_id')) : fallbackGoal),
      spend_by_campaign: campaignRows.filter((row) => row.spend > 0).map((row) => ({ name: row.name, spend: row.spend, share: totalSpend > 0 ? row.spend / totalSpend : 0 })),
      spend_leader: spendLeader,
      best_campaign: bestCampaign,
      attention_campaign: attentionCampaign,
      fetched_at: new Date().toISOString(),
    };
    return { status: 'live', source: 'meta-ads-cli', data: snapshot };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Meta performance data could not be loaded.',
    };
  }
}
