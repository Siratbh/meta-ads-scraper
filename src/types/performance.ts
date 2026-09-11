export type AnalyticsPreset = 'today' | 'last_7d' | 'this_month' | 'last_30d' | 'last_90d' | 'custom';
export type AnalyticsGranularity = 'daily' | 'weekly' | 'monthly';
export type AnalyticsResponseStatus = 'live' | 'not_configured' | 'error';
export type PerformanceHealth = 'strong' | 'watch' | 'attention';

export interface AnalyticsQuery {
  preset: AnalyticsPreset;
  since?: string;
  until?: string;
  granularity: AnalyticsGranularity;
  campaign_ids?: string[];
}

export interface AnalyticsRange {
  preset: AnalyticsPreset;
  label: string;
  since: string;
  until: string;
  granularity: AnalyticsGranularity;
}

export interface PerformanceCampaignOption {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  optimization_goal?: string;
}

export interface PerformanceRow {
  id: string;
  name: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  status?: string;
  objective?: string;
  optimization_goal?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  results: number;
  result_label: string;
  result_type: string;
  cost_per_result: number | null;
  revenue: number;
  roas: number | null;
  health: PerformanceHealth;
  health_reason: string;
}

export interface TrendPoint {
  date: string;
  spend: number;
  results: number;
  cost_per_result: number | null;
}

export interface PerformanceSummary {
  spend: number;
  results: number;
  cost_per_result: number | null;
  revenue: number;
  roas: number | null;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  frequency: number;
  active_campaigns: number;
  active_ads: number;
  daily_budget: number;
  currency: string;
  primary_result_label: string;
  primary_result_type: string;
  mixed_goals: boolean;
}

export interface PerformanceSnapshot {
  account_id: string;
  source: 'meta-ads-cli';
  currency: string;
  range: AnalyticsRange;
  available_campaigns: PerformanceCampaignOption[];
  selected_campaign_ids: string[];
  summary: PerformanceSummary;
  campaigns: PerformanceRow[];
  creatives: PerformanceRow[];
  trend: TrendPoint[];
  spend_by_campaign: Array<{ name: string; spend: number; share: number }>;
  spend_leader: PerformanceRow | null;
  best_campaign: PerformanceRow | null;
  attention_campaign: PerformanceRow | null;
  fetched_at: string;
}

export interface AnalyticsResponse {
  status: AnalyticsResponseStatus;
  source?: 'meta-ads-cli';
  message?: string;
  data?: PerformanceSnapshot;
}
