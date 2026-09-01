'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Platform = 'IG' | 'YouTube' | 'Lemon8' | 'TikTok';
type Brand = 'hustle' | 'second-studio';
type Role = 'admin' | 'editor' | 'viewer';
type Member = { id: string; email: string; role: Role; status: 'active' | 'inactive'; created_at?: string };
type Invite = { email: string; role: Role; status: 'active' | 'inactive'; created_at?: string };
type PlatformMetricKey = 'views' | 'likes' | 'shares' | 'saves' | 'follows' | 'watchTimeHours' | 'subscribersGained' | 'reads';
type Insight = Record<PlatformMetricKey, number> & { postUrl: string };
type Entry = {
  id: string; date: string; hour: string; minute: string; title: string;
  platforms: Platform[]; referenceUrl: string; filmed: boolean; edited: boolean;
  platformData: Record<Platform, Insight>;
};
type StatusKey = 'idea' | 'editing' | 'ready' | 'published';
type AnalyticsMetric = 'views' | 'likes' | 'shares' | 'saves' | 'interactions' | 'follows' | 'engagementRate';
type AnalyticsTotals = { posts: number; views: number; likes: number; shares: number; saves: number; follows: number; interactions: number; engagementRate: number };
type AudienceSnapshot = {
  id?: string; month: string; platform: Platform; startingFollowers: number; endingFollowers: number;
  reach: number; profileVisits: number; linkClicks: number; nonFollowerReachPct: number;
  womenPct: number; menPct: number; primaryAge: string; topLocations: string;
  activeDay: string; activeTime: string; notes: string;
};
type AudienceWeek = { id?: string; month: string; platform: Platform; weekIndex: number; totalFollows: number; unfollows: number };
type Lemon8Week = { id?: string; weekStart: string; reads: number; likesAndSaves: number; follows: number };

const platforms: Platform[] = ['IG', 'YouTube', 'Lemon8', 'TikTok'];
const compactMetric = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const platformMetrics: Record<Platform, { key: PlatformMetricKey; label: string; step?: number }[]> = {
  IG: [{ key: 'views', label: 'Views' }, { key: 'likes', label: 'Likes' }, { key: 'shares', label: 'Shares' }, { key: 'saves', label: 'Saves' }, { key: 'follows', label: 'Follows' }],
  TikTok: [{ key: 'views', label: 'Views' }, { key: 'likes', label: 'Likes' }, { key: 'shares', label: 'Shares' }, { key: 'saves', label: 'Saves' }, { key: 'follows', label: 'Follows' }],
  YouTube: [{ key: 'views', label: 'Views' }, { key: 'subscribersGained', label: 'Subscribers' }],
  Lemon8: [],
};
const opportunityMetricKeys: Record<Platform, PlatformMetricKey[]> = {
  IG: ['views', 'likes', 'shares', 'saves', 'follows'], TikTok: ['views', 'likes', 'shares', 'saves', 'follows'],
  YouTube: ['views', 'subscribersGained'], Lemon8: ['reads', 'likes', 'follows'],
};
const initialAdminEmail = 'elvis@hustle.com.sg';
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const blankInsight = (): Insight => ({ postUrl: '', views: 0, likes: 0, shares: 0, saves: 0, follows: 0, watchTimeHours: 0, subscribersGained: 0, reads: 0 });
const blankPlatformData = (): Record<Platform, Insight> => ({ IG: blankInsight(), YouTube: blankInsight(), Lemon8: blankInsight(), TikTok: blankInsight() });
const today = () => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); };
const addDays = (value: string, amount: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount); return date.toISOString().slice(0, 10); };
const mondayOf = (value: string) => { const date = new Date(`${value}T12:00:00`); const day = date.getDay(); date.setDate(date.getDate() - (day === 0 ? 6 : day - 1)); return date.toISOString().slice(0, 10); };
const weekStartsInRange = (start: string, end: string) => {
  const count = Math.max(1, Math.ceil(inclusiveDays(start, end) / 7));
  const last = mondayOf(end);
  return Array.from({ length: count }, (_, index) => addDays(last, -7 * (count - index - 1)));
};
const currentMonth = () => today().slice(0, 7);
const shiftMonth = (value: string, amount: number) => { const [year, month] = value.split('-').map(Number); const date = new Date(year, month - 1 + amount, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
const inclusiveDays = (start: string, end: string) => Math.max(0, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1);
const emptyEntry = (): Entry => ({ id: '', date: today(), hour: '12', minute: '00', title: '', platforms: [], referenceUrl: '', filmed: false, edited: false, platformData: blankPlatformData() });
const insightRate = (data: Insight) => data.views ? ((data.likes + data.shares + data.saves) / data.views) * 100 : 0;
const platformMetricValue = (data: Insight, key: PlatformMetricKey) => Number(data[key] || 0);
const platformConsumption = (data: Insight, platform: Platform) => platform === 'Lemon8' ? 0 : data.views;
const platformActions = (data: Insight, platform: Platform) => platform === 'YouTube' || platform === 'Lemon8' ? 0 : data.likes + data.saves + data.shares;
const platformAudienceGained = (data: Insight, platform: Platform) => platform === 'YouTube' ? data.subscribersGained : platform === 'Lemon8' ? 0 : data.follows;
const publishedPlatforms = (entry: Entry) => entry.platforms.filter((platform) => entry.platformData[platform].postUrl);
const overallRate = (entry: Entry) => {
  const consumption = entry.platforms.reduce((sum, platform) => sum + platformConsumption(entry.platformData[platform], platform), 0);
  const actions = entry.platforms.reduce((sum, platform) => sum + platformActions(entry.platformData[platform], platform), 0);
  return consumption ? (actions / consumption) * 100 : 0;
};
const totalViews = (entry: Entry) => entry.platforms.reduce((sum, platform) => sum + platformConsumption(entry.platformData[platform], platform), 0);
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const platformViralScore = (data: Insight, platform: Platform, allEntries: Entry[], currentId = '') => {
  const scores = platformMetrics[platform].map(({ key }) => {
    const current = platformMetricValue(data, key);
    const sampleMedian = median(allEntries.filter((entry) => entry.id !== currentId && entry.platforms.includes(platform)).map((entry) => platformMetricValue(entry.platformData[platform], key)).filter((value) => value > 0));
    if (!current) return null;
    return sampleMedian > 0 ? Math.min(current / sampleMedian, 1) * 100 : 100;
  }).filter((score): score is number => score !== null);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
};
const overallViralScore = (entry: Entry, allEntries: Entry[]) => {
  const scores = entry.platforms.map((platform) => platformViralScore(entry.platformData[platform], platform, allEntries, entry.id)).filter((score) => score > 0);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
};
const statusOf = (entry: Entry): { key: StatusKey; label: string } => {
  if (publishedPlatforms(entry).length) return { key: 'published', label: 'Published' };
  if (entry.filmed && entry.edited) return { key: 'ready', label: 'Ready' };
  if (entry.filmed) return { key: 'editing', label: 'Editing' };
  return { key: 'idea', label: 'Idea / Filming' };
};
const safeLink = (value: string) => !value ? '' : /^https?:\/\//i.test(value) ? value : `https://${value}`;
const storageKey = (brand: Brand) => `content-calendar-entries-${brand}`;

function aggregateAnalytics(entries: Entry[], start: string, end: string, platform: 'all' | Platform): AnalyticsTotals {
  const totals: AnalyticsTotals = { posts: 0, views: 0, likes: 0, shares: 0, saves: 0, follows: 0, interactions: 0, engagementRate: 0 };
  entries.filter((entry) => entry.date >= start && entry.date <= end).forEach((entry) => {
    const selectedPlatforms = entry.platforms.filter((item) => platform === 'all' || item === platform);
    if (selectedPlatforms.some((item) => Boolean(entry.platformData[item].postUrl))) totals.posts += 1;
    selectedPlatforms.forEach((item) => {
      const data = entry.platformData[item];
      totals.views += platformConsumption(data, item);
      totals.likes += item === 'YouTube' || item === 'Lemon8' ? 0 : data.likes;
      totals.shares += item === 'IG' || item === 'TikTok' ? data.shares : 0;
      totals.saves += item === 'YouTube' || item === 'Lemon8' ? 0 : data.saves;
      totals.follows += platformAudienceGained(data, item);
    });
  });
  totals.interactions = totals.likes + totals.shares + totals.saves;
  totals.engagementRate = totals.views ? (totals.interactions / totals.views) * 100 : 0;
  return totals;
}

const analyticsMetricValue = (totals: AnalyticsTotals, metric: AnalyticsMetric) => totals[metric];
const platformRawMetricSamples = (entries: Entry[], start: string, end: string, platform: Platform, metric: PlatformMetricKey) => entries
  .filter((entry) => entry.date >= start && entry.date <= end && entry.platforms.includes(platform) && Boolean(entry.platformData[platform].postUrl))
  .map((entry) => platformMetricValue(entry.platformData[platform], metric));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const lemon8WeeksInRange = (weeks: Lemon8Week[], start: string, end: string) => {
  const starts = new Set(weekStartsInRange(start, end));
  return weeks.filter((week) => starts.has(week.weekStart));
};
const aggregateLemon8Weekly = (weeks: Lemon8Week[], entries: Entry[], start: string, end: string): AnalyticsTotals => {
  const selected = lemon8WeeksInRange(weeks, start, end);
  const totals: AnalyticsTotals = {
    posts: entries.filter((entry) => entry.date >= start && entry.date <= end && entry.platforms.includes('Lemon8') && Boolean(entry.platformData.Lemon8.postUrl)).length,
    views: selected.reduce((sum, week) => sum + week.reads, 0), likes: 0, shares: 0, saves: 0,
    follows: selected.reduce((sum, week) => sum + week.follows, 0), interactions: selected.reduce((sum, week) => sum + week.likesAndSaves, 0), engagementRate: 0,
  };
  totals.engagementRate = totals.views ? (totals.interactions / totals.views) * 100 : 0;
  return totals;
};
const aggregatePlatformAnalytics = (weeks: Lemon8Week[], entries: Entry[], start: string, end: string, platform: 'all' | Platform) => {
  if (platform === 'Lemon8') return aggregateLemon8Weekly(weeks, entries, start, end);
  const totals = aggregateAnalytics(entries, start, end, platform);
  if (platform === 'all') {
    const weekly = aggregateLemon8Weekly(weeks, entries, start, end);
    totals.views += weekly.views; totals.follows += weekly.follows; totals.interactions += weekly.interactions;
    totals.engagementRate = totals.views ? (totals.interactions / totals.views) * 100 : 0;
  }
  return totals;
};
const changeValue = (current: number, previous: number) => previous === 0 ? null : ((current - previous) / previous) * 100;
type ChartPoint = { x: number; y: number; value: number };
const chartPoints = (values: number[], maximum: number, width: number, height: number, padding: number): ChartPoint[] => values.map((value, index) => ({
  x: values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2),
  y: height - padding - (value / Math.max(1, maximum)) * (height - padding * 2),
  value,
}));
const smoothChartPath = (points: ChartPoint[]) => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
};
const blankAudience = (month = currentMonth(), platform: Platform = 'IG'): AudienceSnapshot => ({ id: undefined, month, platform, startingFollowers: 0, endingFollowers: 0, reach: 0, profileVisits: 0, linkClicks: 0, nonFollowerReachPct: 0, womenPct: 0, menPct: 0, primaryAge: '', topLocations: '', activeDay: '', activeTime: '', notes: '' });
const audienceGrowth = (item?: AudienceSnapshot) => item?.startingFollowers ? ((item.endingFollowers - item.startingFollowers) / item.startingFollowers) * 100 : 0;
const audienceNewFollowers = (item?: AudienceSnapshot) => item ? item.endingFollowers - item.startingFollowers : 0;
const audienceRate = (numerator: number, denominator: number) => denominator > 0 ? (numerator / denominator) * 100 : 0;

function normalizeAudience(raw: Record<string, unknown>): AudienceSnapshot {
  return {
    id: String(raw.id || ''), month: String(raw.month_key || currentMonth()).slice(0, 7), platform: raw.platform as Platform,
    startingFollowers: Number(raw.starting_followers || 0), endingFollowers: Number(raw.ending_followers || 0), reach: Number(raw.reach || 0),
    profileVisits: Number(raw.profile_visits || 0), linkClicks: Number(raw.link_clicks || 0), nonFollowerReachPct: Number(raw.non_follower_reach_pct || 0),
    womenPct: Number(raw.women_pct || 0), menPct: Number(raw.men_pct || 0), primaryAge: String(raw.primary_age || ''), topLocations: String(raw.top_locations || ''),
    activeDay: String(raw.active_day || ''), activeTime: String(raw.active_time || ''), notes: String(raw.notes || ''),
  };
}

function normalizeAudienceWeek(raw: Record<string, unknown>): AudienceWeek {
  return { id: String(raw.id || ''), month: String(raw.month_key || currentMonth()).slice(0, 7), platform: raw.platform as Platform, weekIndex: Number(raw.week_index || 1), totalFollows: Number(raw.total_follows || 0), unfollows: Number(raw.unfollows || 0) };
}

function normalizeLemon8Week(raw: Record<string, unknown>): Lemon8Week {
  return { id: String(raw.id || ''), weekStart: String(raw.week_start || today()), reads: Number(raw.reads || 0), likesAndSaves: Number(raw.likes_and_saves ?? (Number(raw.likes || 0) + Number(raw.saves || 0))), follows: Number(raw.follows || 0) };
}

function monthWeekPeriods(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return [1, 8, 15, 22, 29].filter((start) => start <= lastDay).map((start, index) => {
    const end = Math.min(start + 6, lastDay);
    const pad = (value: number) => String(value).padStart(2, '0');
    return { weekIndex: index + 1, label: `Week ${index + 1}`, range: `${start}–${end}`, start: `${month}-${pad(start)}`, end: `${month}-${pad(end)}` };
  });
}

function normalizeEntry(raw: Record<string, unknown>): Entry {
  const selected = Array.isArray(raw.platforms) ? raw.platforms.filter((item): item is Platform => platforms.includes(item as Platform)) : [];
  const data = blankPlatformData();
  const existing = (raw.platformData || raw.platform_data) as Partial<Record<Platform, Partial<Insight>>> | undefined;
  platforms.forEach((platform) => { if (existing?.[platform]) data[platform] = { ...data[platform], ...existing[platform] }; });
  if (existing?.YouTube && existing.YouTube.subscribersGained === undefined) data.YouTube.subscribersGained = Number(existing.YouTube.follows || 0);
  if (existing?.Lemon8 && existing.Lemon8.reads === undefined) data.Lemon8.reads = Number(existing.Lemon8.views || 0);
  if (!existing && selected[0]) {
    data[selected[0]] = {
      postUrl: String(raw.postUrl || ''), views: Number(raw.views || 0), likes: Number(raw.likes || 0),
      shares: Number(raw.shares || 0), saves: Number(raw.saves || 0), follows: Number(raw.follows || 0), watchTimeHours: 0,
      subscribersGained: selected[0] === 'YouTube' ? Number(raw.follows || 0) : 0,
      reads: selected[0] === 'Lemon8' ? Number(raw.views || 0) : 0,
    };
  }
  return {
    id: String(raw.id || crypto.randomUUID()), date: String(raw.date || raw.publish_date || today()), hour: String(raw.hour || raw.publish_hour || '12'), minute: String(raw.minute || raw.publish_minute || '00'),
    title: String(raw.title || ''), platforms: selected, referenceUrl: String(raw.referenceUrl || raw.reference_url || ''),
    filmed: Boolean(raw.filmed), edited: Boolean(raw.edited), platformData: data,
  };
}

function cloudRow(entry: Entry, brand: Brand, userId: string) {
  return {
    id: entry.id,
    brand,
    publish_date: entry.date,
    publish_hour: entry.hour,
    publish_minute: entry.minute,
    title: entry.title,
    platforms: entry.platforms,
    reference_url: entry.referenceUrl,
    filmed: entry.filmed,
    edited: entry.edited,
    platform_data: entry.platformData,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
}

export default function Home() {
  const [brand, setBrand] = useState<Brand>('hustle');
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed-out' | 'ready' | 'denied'>('loading');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [authError, setAuthError] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>(emptyEntry);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<'calendar' | 'list' | 'insights' | 'audience'>('calendar');
  const [activePlatform, setActivePlatform] = useState<Platform>('IG');
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');
  const [analyticsPlatform, setAnalyticsPlatform] = useState<'all' | Platform>('all');
  const [analyticsMetric, setAnalyticsMetric] = useState<AnalyticsMetric>('views');
  const [analyticsPreset, setAnalyticsPreset] = useState<'last7' | 'last30' | 'custom'>('last7');
  const [analyticsEnd, setAnalyticsEnd] = useState(today);
  const [analyticsStart, setAnalyticsStart] = useState(() => addDays(today(), -6));
  const [compareAnalytics, setCompareAnalytics] = useState(true);
  const [syncState, setSyncState] = useState<'loading' | 'saving' | 'synced' | 'error'>('loading');
  const [localImportCount, setLocalImportCount] = useState(0);
  const [showTeam, setShowTeam] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [teamError, setTeamError] = useState('');
  const [teamMessage, setTeamMessage] = useState('');
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [audienceMonth, setAudienceMonth] = useState(currentMonth);
  const [audiencePlatform, setAudiencePlatform] = useState<Platform>('IG');
  const [audienceSnapshots, setAudienceSnapshots] = useState<AudienceSnapshot[]>([]);
  const [audienceWeeks, setAudienceWeeks] = useState<AudienceWeek[]>([]);
  const [audienceWeekDrafts, setAudienceWeekDrafts] = useState<AudienceWeek[]>([]);
  const [audienceDraft, setAudienceDraft] = useState<AudienceSnapshot>(() => blankAudience());
  const [audienceBusy, setAudienceBusy] = useState(false);
  const [audienceError, setAudienceError] = useState('');
  const [audienceMessage, setAudienceMessage] = useState('');
  const [lemon8Weeks, setLemon8Weeks] = useState<Lemon8Week[]>([]);
  const [lemon8Busy, setLemon8Busy] = useState(false);
  const [lemon8Message, setLemon8Message] = useState('');
  const [lemon8Error, setLemon8Error] = useState('');
  const audienceDirty = useRef(false);
  const audienceSaveTimer = useRef<number | null>(null);
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });

  useEffect(() => {
    const preferred = window.localStorage.getItem('content-calendar-brand');
    if (preferred === 'hustle' || preferred === 'second-studio') setBrand(preferred);
  }, []);

  useEffect(() => {
    let active = true;
    async function resolveUser(user: User | null) {
      if (!active) return;
      setAuthUser(user);
      setMember(null);
      setAuthError('');
      if (!user) { setAuthStatus('signed-out'); return; }
      setAuthStatus('loading');
      const { error: bootstrapError } = await supabase.rpc('bootstrap_member');
      if (bootstrapError) {
        if (!active) return;
        setAuthError(bootstrapError.message.includes('invited') ? 'This email has not been added by an admin.' : bootstrapError.message);
        setAuthStatus('denied');
        return;
      }
      const { data, error } = await supabase.from('members').select('id,email,role,status,created_at').eq('id', user.id).single();
      if (!active) return;
      if (error || !data || data.status !== 'active') {
        setAuthError(error?.message || 'This account is inactive.');
        setAuthStatus('denied');
        return;
      }
      setMember(data as Member);
      setAuthStatus('ready');
    }
    void supabase.auth.getSession().then(({ data }) => resolveUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void resolveUser(session?.user || null), 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (authStatus !== 'ready') return;
    let active = true;
    window.localStorage.setItem('content-calendar-brand', brand);
    setSyncState('loading');
    setEntries([]);
    setPlatformFilter('all');
    setStatusFilter('all');
    setShowForm(false);

    async function loadCloudEntries() {
      const { data, error } = await supabase.from('content_entries').select('*').eq('brand', brand).order('publish_date');
      if (!active) return;
      if (error) { setSyncState('error'); return; }
      setEntries((data || []).map((row) => normalizeEntry(row as Record<string, unknown>)));
      setSyncState('synced');
      const localText = window.localStorage.getItem(storageKey(brand))
        || (brand === 'hustle' ? window.localStorage.getItem('content-calendar-entries') : null);
      if (!window.localStorage.getItem(`content-calendar-imported-${brand}`) && localText) {
        try { setLocalImportCount((JSON.parse(localText) as unknown[]).length); } catch { setLocalImportCount(0); }
      } else setLocalImportCount(0);
    }

    void loadCloudEntries();
    const channel = supabase.channel(`content-entries-${brand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_entries', filter: `brand=eq.${brand}` }, () => void loadCloudEntries())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [authStatus, brand]);

  useEffect(() => {
    if (authStatus !== 'ready') return;
    let active = true;
    async function loadLemon8Weeks() {
      const { data, error } = await supabase.from('lemon8_weekly_performance').select('*').eq('brand', brand).order('week_start');
      if (!active) return;
      if (error) { setLemon8Error('Run the updated setup.sql once in Supabase to enable Lemon8 weekly performance.'); return; }
      setLemon8Weeks((data || []).map((row) => normalizeLemon8Week(row as Record<string, unknown>)));
      setLemon8Error('');
    }
    void loadLemon8Weeks();
    const channel = supabase.channel(`lemon8-weekly-${brand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lemon8_weekly_performance', filter: `brand=eq.${brand}` }, () => void loadLemon8Weeks())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [authStatus, brand]);

  useEffect(() => {
    if (authStatus !== 'ready') return;
    let active = true;
    async function loadAudience() {
      const [monthlyResult, weeklyResult] = await Promise.all([
        supabase.from('audience_monthly').select('*').eq('brand', brand).order('month_key'),
        supabase.from('audience_weekly').select('*').eq('brand', brand).order('month_key').order('week_index'),
      ]);
      if (!active) return;
      const error = monthlyResult.error || weeklyResult.error;
      if (error) { setAudienceError(error.message.includes('audience_') ? 'Audience cloud tables are not ready. Run the updated setup.sql once in Supabase.' : error.message); return; }
      setAudienceSnapshots((monthlyResult.data || []).map((row) => normalizeAudience(row as Record<string, unknown>)));
      setAudienceWeeks((weeklyResult.data || []).map((row) => normalizeAudienceWeek(row as Record<string, unknown>)));
      setAudienceError('');
    }
    void loadAudience();
    const channel = supabase.channel(`audience-monthly-${brand}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audience_monthly', filter: `brand=eq.${brand}` }, () => void loadAudience())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audience_weekly', filter: `brand=eq.${brand}` }, () => void loadAudience())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [authStatus, brand]);

  useEffect(() => {
    const existing = audienceSnapshots.find((item) => item.month === audienceMonth && item.platform === audiencePlatform);
    setAudienceDraft(existing ? { ...existing } : blankAudience(audienceMonth, audiencePlatform));
    setAudienceWeekDrafts(monthWeekPeriods(audienceMonth).map((period) => audienceWeeks.find((item) => item.month === audienceMonth && item.platform === audiencePlatform && item.weekIndex === period.weekIndex) || { month: audienceMonth, platform: audiencePlatform, weekIndex: period.weekIndex, totalFollows: 0, unfollows: 0 }));
    audienceDirty.current = false;
  }, [audienceMonth, audiencePlatform, audienceSnapshots, audienceWeeks]);

  useEffect(() => {
    if (authStatus !== 'ready' || member?.role === 'viewer' || !audienceDirty.current) return;
    if (audienceSaveTimer.current) window.clearTimeout(audienceSaveTimer.current);
    audienceSaveTimer.current = window.setTimeout(() => void persistAudience(true), 900);
    return () => { if (audienceSaveTimer.current) window.clearTimeout(audienceSaveTimer.current); };
  }, [audienceDraft, audienceWeekDrafts, authStatus, member?.role]);

  const filteredEntries = useMemo(() => entries.filter((entry) =>
    (platformFilter === 'all' || entry.platforms.includes(platformFilter)) &&
    (statusFilter === 'all' || statusOf(entry).key === statusFilter)
  ), [entries, platformFilter, statusFilter]);
  const selectedMonthEntries = useMemo(() => entries.filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }), [entries, month]);
  const monthEntries = useMemo(() => filteredEntries.filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }), [filteredEntries, month]);
  const calendarDays = useMemo(() => {
    const firstDay = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);
  const published = selectedMonthEntries.filter((entry) => publishedPlatforms(entry).length).length;
  const ready = selectedMonthEntries.filter((entry) => statusOf(entry).key === 'ready').length;
  const bestScore = selectedMonthEntries.reduce((top, entry) => Math.max(top, overallViralScore(entry, selectedMonthEntries)), 0);
  const summaryMonthLabel = month.toLocaleDateString('en', { month: 'short', year: 'numeric' });
  const analyticsDuration = inclusiveDays(analyticsStart, analyticsEnd);
  const comparisonEnd = analyticsDuration ? addDays(analyticsStart, -1) : analyticsStart;
  const comparisonStart = analyticsDuration ? addDays(comparisonEnd, -(analyticsDuration - 1)) : analyticsStart;
  const analyticsTotals = useMemo(() => aggregatePlatformAnalytics(lemon8Weeks, entries, analyticsStart, analyticsEnd, analyticsPlatform), [entries, lemon8Weeks, analyticsStart, analyticsEnd, analyticsPlatform]);
  const comparisonTotals = useMemo(() => aggregatePlatformAnalytics(lemon8Weeks, entries, comparisonStart, comparisonEnd, analyticsPlatform), [entries, lemon8Weeks, comparisonStart, comparisonEnd, analyticsPlatform]);
  const lemon8ReportRows = weekStartsInRange(analyticsStart, analyticsEnd).map((weekStart) => {
    const existing = lemon8Weeks.find((week) => week.weekStart === weekStart) || { weekStart, reads: 0, likesAndSaves: 0, follows: 0 };
    const weekEnd = addDays(weekStart, 6);
    const posts = entries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd && entry.platforms.includes('Lemon8') && Boolean(entry.platformData.Lemon8.postUrl)).length;
    return { ...existing, weekEnd, posts };
  });
  const opportunityPlatforms = useMemo(() => platforms.map((platform) => {
    const metrics = opportunityMetricKeys[platform];
    const metricSamples = (start: string, end: string, metric: PlatformMetricKey) => platform === 'Lemon8'
      ? lemon8WeeksInRange(lemon8Weeks, start, end).map((week) => metric === 'reads' ? week.reads : metric === 'likes' ? week.likesAndSaves : week.follows)
      : platformRawMetricSamples(entries, start, end, platform, metric);
    const metricIndexes = metrics.map((metric) => {
      const currentSamples = metricSamples(analyticsStart, analyticsEnd, metric);
      const previousSamples = metricSamples(comparisonStart, comparisonEnd, metric);
      const benchmarkValues = Array.from({ length: 4 }, (_, index) => {
        const periodEnd = addDays(analyticsStart, -1 - index * Math.max(1, analyticsDuration));
        const periodStart = addDays(periodEnd, -(Math.max(1, analyticsDuration) - 1));
        const samples = metricSamples(periodStart, periodEnd, metric);
        return samples.length ? average(samples) : null;
      }).filter((value): value is number => value !== null);
      const benchmarkMedian = median(benchmarkValues);
      const benchmark = benchmarkMedian > 0 ? benchmarkMedian : average(benchmarkValues);
      const current = average(currentSamples);
      const previous = average(previousSamples);
      return benchmark > 0 && currentSamples.length > 0 && previousSamples.length > 0
        ? { currentIndex: (current / benchmark) * 100, previousIndex: (previous / benchmark) * 100, benchmarkPeriods: benchmarkValues.length }
        : null;
    }).filter((item): item is { currentIndex: number; previousIndex: number; benchmarkPeriods: number } => Boolean(item));
    const currentPosts = entries.filter((entry) => entry.date >= analyticsStart && entry.date <= analyticsEnd && entry.platforms.includes(platform) && Boolean(entry.platformData[platform].postUrl)).length;
    const previousPosts = entries.filter((entry) => entry.date >= comparisonStart && entry.date <= comparisonEnd && entry.platforms.includes(platform) && Boolean(entry.platformData[platform].postUrl)).length;
    const currentObservations = platform === 'Lemon8' ? lemon8WeeksInRange(lemon8Weeks, analyticsStart, analyticsEnd).length : currentPosts;
    const previousObservations = platform === 'Lemon8' ? lemon8WeeksInRange(lemon8Weeks, comparisonStart, comparisonEnd).length : previousPosts;
    const performanceIndex = average(metricIndexes.map((item) => item.currentIndex));
    const previousPerformanceIndex = average(metricIndexes.map((item) => item.previousIndex));
    const momentum = performanceIndex - previousPerformanceIndex;
    const isNew = currentObservations > 0 && previousObservations === 0;
    const benchmarkPeriods = metricIndexes.length ? Math.min(...metricIndexes.map((item) => item.benchmarkPeriods)) : 0;
    const hasCoordinates = currentObservations > 0 && previousObservations > 0 && metricIndexes.length >= 2 && benchmarkPeriods >= 2;
    const lowConfidence = hasCoordinates && (currentObservations < (platform === 'Lemon8' ? 2 : 3) || previousObservations < (platform === 'Lemon8' ? 2 : 3) || benchmarkPeriods < 4 || metricIndexes.length < metrics.length);
    const quadrant = performanceIndex >= 100
      ? momentum >= 0 ? 'scale' : 'protect'
      : momentum >= 0 ? 'test' : 'fix';
    return { platform, currentPosts, previousPosts, currentObservations, previousObservations, momentum, performanceIndex, previousPerformanceIndex, contribution: currentPosts, isNew, hasCoordinates, lowConfidence, quadrant, benchmarkPeriods, metricCount: metricIndexes.length };
  }), [entries, lemon8Weeks, analyticsStart, analyticsEnd, comparisonStart, comparisonEnd, analyticsDuration]);
  const opportunityVisible = opportunityPlatforms.filter((item) => item.hasCoordinates);
  const opportunityUnavailable = opportunityPlatforms.filter((item) => !item.hasCoordinates);
  const opportunityMomentumMax = Math.max(25, ...opportunityVisible.map((item) => Math.abs(item.momentum)));
  const opportunityContributionMax = Math.max(1, ...opportunityVisible.map((item) => item.contribution));
  const opportunityRecommendations = opportunityVisible.slice().sort((a, b) => {
    const priority: Record<string, number> = { scale: 0, test: 1, protect: 2, fix: 3 };
    return priority[a.quadrant] - priority[b.quadrant] || b.performanceIndex - a.performanceIndex;
  });
  const starConclusion = (() => {
    if (!opportunityVisible.length) return { title: 'Not enough history for a reliable conclusion yet', advice: 'Keep recording platform results. The map needs at least two earlier matching periods and data for at least two of that platform’s selected metrics.' };
    const scale = opportunityVisible.filter((item) => item.quadrant === 'scale').sort((a, b) => b.performanceIndex + b.momentum - (a.performanceIndex + a.momentum))[0];
    const test = opportunityVisible.filter((item) => item.quadrant === 'test').sort((a, b) => b.momentum - a.momentum)[0];
    const protect = opportunityVisible.filter((item) => item.quadrant === 'protect').sort((a, b) => a.momentum - b.momentum)[0];
    const fix = opportunityVisible.filter((item) => item.quadrant === 'fix').sort((a, b) => a.performanceIndex + a.momentum - (b.performanceIndex + b.momentum))[0];
    const risk = fix || protect;
    const confidenceNote = opportunityVisible.some((item) => item.lowConfidence) ? ' Recheck after more posts—or at least 2 weekly Lemon8 reports—are available in both periods.' : '';
    if (scale && risk) return { title: `Mixed result: ${scale.platform} is ready to scale, while ${risk.platform} needs attention`, advice: `Move one content slot next period toward ${scale.platform}, reuse its strongest recent format, and use the freed ${risk.platform} slot for one redesigned test instead of repeating the same approach.${confidenceNote}` };
    if (scale) return { title: `${scale.platform} is the clearest growth opportunity`, advice: `Add one more ${scale.platform} post in the next matching period and repeat the topic or format behind its strongest recent content. Keep the other platforms at their current cadence while you validate the lift.${confidenceNote}` };
    if (test) return { title: `${test.platform} is improving, but it has not proven strong performance yet`, advice: `Keep ${test.platform} volume steady and run 2–3 focused tests using one variable at a time—hook, format or topic—before increasing output.${confidenceNote}` };
    if (protect) return { title: `${protect.platform} is still strong, but momentum is weakening`, advice: `Do not cut ${protect.platform} yet. Audit the latest hooks, topics and posting consistency against the earlier period, then restore the strongest pattern.${confidenceNote}` };
    return { title: `${fix?.platform || opportunityVisible[0].platform} needs correction before more investment`, advice: `Pause expansion, change the content angle or format, and collect at least 3 new posts before deciding whether to reduce this platform further.${confidenceNote}` };
  })();
  const analyticsBuckets = useMemo(() => {
    if (!analyticsDuration) return [];
    const bucketSize = analyticsPlatform === 'Lemon8' || analyticsPlatform === 'all' ? 7 : analyticsDuration <= 14 ? 1 : analyticsDuration <= 60 ? 7 : 30;
    const buckets: { label: string; current: number; previous: number }[] = [];
    for (let offset = 0; offset < analyticsDuration; offset += bucketSize) {
      const currentStart = addDays(analyticsStart, offset);
      const proposedCurrentEnd = addDays(currentStart, bucketSize - 1);
      const currentEnd = proposedCurrentEnd > analyticsEnd ? analyticsEnd : proposedCurrentEnd;
      const previousStart = addDays(comparisonStart, offset);
      const previousEnd = addDays(previousStart, inclusiveDays(currentStart, currentEnd) - 1);
      buckets.push({
        label: bucketSize === 1
          ? new Date(`${currentStart}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })
          : `${new Date(`${currentStart}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' })}–${new Date(`${currentEnd}T00:00:00`).toLocaleDateString('en', { day: 'numeric' })}`,
        current: analyticsMetricValue(aggregatePlatformAnalytics(lemon8Weeks, entries, currentStart, currentEnd, analyticsPlatform), analyticsMetric),
        previous: analyticsMetricValue(aggregatePlatformAnalytics(lemon8Weeks, entries, previousStart, previousEnd, analyticsPlatform), analyticsMetric),
      });
    }
    return buckets;
  }, [entries, lemon8Weeks, analyticsStart, analyticsEnd, analyticsPlatform, analyticsMetric, analyticsDuration, comparisonStart]);
  const analyticsChartMax = Math.max(1, ...analyticsBuckets.flatMap((bucket) => [bucket.current, compareAnalytics ? bucket.previous : 0]));
  const chartWidth = 1000;
  const chartHeight = 280;
  const chartPadding = 28;
  const currentChartPoints = chartPoints(analyticsBuckets.map((bucket) => bucket.current), analyticsChartMax, chartWidth, chartHeight, chartPadding);
  const previousChartPoints = chartPoints(analyticsBuckets.map((bucket) => bucket.previous), analyticsChartMax, chartWidth, chartHeight, chartPadding);
  const currentChartPath = smoothChartPath(currentChartPoints);
  const previousChartPath = smoothChartPath(previousChartPoints);
  const currentAreaPath = currentChartPoints.length ? `${currentChartPath} L ${currentChartPoints.at(-1)?.x} ${chartHeight - chartPadding} L ${currentChartPoints[0].x} ${chartHeight - chartPadding} Z` : '';
  const currentValues = analyticsBuckets.map((bucket) => bucket.current);
  const chartPeak = Math.max(0, ...currentValues);
  const chartMedian = median(currentValues.filter((value) => value > 0));
  const viralSpikeIndex = chartPeak > 0 && chartPeak >= Math.max(chartMedian * 2, 1) ? currentValues.indexOf(chartPeak) : -1;
  const chartTickValue = (ratio: number) => analyticsMetric === 'engagementRate' ? `${(analyticsChartMax * ratio).toFixed(1)}%` : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(analyticsChartMax * ratio);
  const analyticsRangeEntries = useMemo(() => entries.filter((entry) => entry.date >= analyticsStart && entry.date <= analyticsEnd && (analyticsPlatform === 'all' || entry.platforms.includes(analyticsPlatform))), [entries, analyticsStart, analyticsEnd, analyticsPlatform]);
  const topContents = useMemo(() => analyticsPlatform === 'Lemon8' ? [] : analyticsRangeEntries.map((entry) => {
    const selectedPlatforms = entry.platforms.filter((platform) => analyticsPlatform === 'all' || platform === analyticsPlatform);
    const consumption = selectedPlatforms.reduce((sum, platform) => sum + platformConsumption(entry.platformData[platform], platform), 0);
    const actions = selectedPlatforms.reduce((sum, platform) => sum + platformActions(entry.platformData[platform], platform), 0);
    const audience = selectedPlatforms.reduce((sum, platform) => sum + platformAudienceGained(entry.platformData[platform], platform), 0);
    const selectedData = analyticsPlatform === 'all' ? null : entry.platformData[analyticsPlatform];
    const topMetrics = analyticsPlatform === 'YouTube' && selectedData
      ? [{ label: 'Views', value: compactMetric.format(selectedData.views) }, { label: 'Subscribers', value: compactMetric.format(selectedData.subscribersGained) }]
      : analyticsPlatform !== 'all' && selectedData
        ? [{ label: 'Views', value: compactMetric.format(selectedData.views) }, { label: 'Actions', value: compactMetric.format(platformActions(selectedData, analyticsPlatform)) }, { label: 'Follows', value: compactMetric.format(selectedData.follows) }]
        : [{ label: 'Views', value: compactMetric.format(consumption) }, { label: 'Actions', value: compactMetric.format(actions) }, { label: 'Audience', value: compactMetric.format(audience) }];
    const score = analyticsPlatform === 'all'
      ? overallViralScore(entry, analyticsRangeEntries)
      : platformViralScore(entry.platformData[analyticsPlatform], analyticsPlatform, analyticsRangeEntries, entry.id);
    return { entry, selectedPlatforms, consumption, topMetrics, score, isPublished: selectedPlatforms.some((platform) => Boolean(entry.platformData[platform].postUrl)) };
  }).filter((item) => item.isPublished).sort((a, b) => b.score - a.score || b.consumption - a.consumption).slice(0, 5), [analyticsRangeEntries, analyticsPlatform]);
  const previousAudience = audienceSnapshots.find((item) => item.month === shiftMonth(audienceMonth, -1) && item.platform === audiencePlatform);
  const audienceMonthSnapshots = platforms.map((platform) => audienceSnapshots.find((item) => item.month === audienceMonth && item.platform === platform)).filter((item): item is AudienceSnapshot => Boolean(item));
  const weekPeriods = monthWeekPeriods(audienceMonth);
  const weeklyAudienceBreakdown = weekPeriods.map((period) => {
    const weekly = audienceWeekDrafts.find((item) => item.weekIndex === period.weekIndex) || { month: audienceMonth, platform: audiencePlatform, weekIndex: period.weekIndex, totalFollows: 0, unfollows: 0 };
    return { ...period, ...weekly, netGrowth: weekly.totalFollows - weekly.unfollows };
  });
  const hasWeeklyAudience = audienceWeekDrafts.some((item) => item.totalFollows > 0 || item.unfollows > 0);
  const monthlyTotalFollows = weeklyAudienceBreakdown.reduce((sum, item) => sum + item.totalFollows, 0);
  const monthlyUnfollows = weeklyAudienceBreakdown.reduce((sum, item) => sum + item.unfollows, 0);
  const monthlyNetGrowth = monthlyTotalFollows - monthlyUnfollows;
  const weeklyAudienceChartMax = Math.max(1, ...weeklyAudienceBreakdown.flatMap((item) => [item.totalFollows, item.unfollows, Math.abs(item.netGrowth)]));
  const expectedEndingFollowers = audienceDraft.startingFollowers + monthlyNetGrowth;
  const reconciliationDifference = audienceDraft.endingFollowers - expectedEndingFollowers;
  const audienceMonthEnd = `${audienceMonth}-${String(new Date(Number(audienceMonth.slice(0, 4)), Number(audienceMonth.slice(5, 7)), 0).getDate()).padStart(2, '0')}`;
  const audienceContentEntries = entries.filter((entry) => entry.date >= `${audienceMonth}-01` && entry.date <= audienceMonthEnd && entry.platforms.includes(audiencePlatform) && entry.platformData[audiencePlatform].follows > 0);
  const monthlyContentFollows = audienceContentEntries.reduce((sum, entry) => sum + entry.platformData[audiencePlatform].follows, 0);
  const audienceContentLeaders = audienceContentEntries.slice().sort((a, b) => b.platformData[audiencePlatform].follows - a.platformData[audiencePlatform].follows).slice(0, 3);
  const strongestAudienceWeek = weeklyAudienceBreakdown.slice().sort((a, b) => b.netGrowth - a.netGrowth)[0];
  const audienceNew = hasWeeklyAudience ? monthlyNetGrowth : audienceNewFollowers(audienceDraft);
  const audienceGrowthRate = audienceDraft.startingFollowers ? (audienceNew / audienceDraft.startingFollowers) * 100 : 0;
  const followConversion = audienceRate(hasWeeklyAudience ? monthlyTotalFollows : Math.max(0, audienceNew), audienceDraft.reach);
  const profileVisitRate = audienceRate(audienceDraft.profileVisits, audienceDraft.reach);
  const linkConversion = audienceRate(audienceDraft.linkClicks, audienceDraft.profileVisits);
  const previousMonthWeeks = audienceWeeks.filter((item) => item.month === shiftMonth(audienceMonth, -1) && item.platform === audiencePlatform);
  const previousMonthNet = previousMonthWeeks.reduce((sum, item) => sum + item.totalFollows - item.unfollows, 0);
  const previousGrowthRate = previousAudience?.startingFollowers && previousMonthWeeks.length ? (previousMonthNet / previousAudience.startingFollowers) * 100 : audienceGrowth(previousAudience);
  const bestAudiencePlatform = audienceMonthSnapshots.slice().sort((a, b) => audienceRate(Math.max(0, audienceNewFollowers(b)), b.reach) - audienceRate(Math.max(0, audienceNewFollowers(a)), a.reach))[0];
  const audienceHasData = audienceDraft.startingFollowers > 0 || audienceDraft.endingFollowers > 0 || audienceDraft.reach > 0 || hasWeeklyAudience;
  const audienceAnalysis = !audienceHasData ? [
    `Add ${audiencePlatform} totals for ${audienceMonth} to generate your monthly analysis.`,
  ] : [
    `${audiencePlatform} recorded ${monthlyTotalFollows.toLocaleString()} follows and ${monthlyUnfollows.toLocaleString()} unfollows, producing ${audienceNew >= 0 ? '+' : ''}${audienceNew.toLocaleString()} net growth (${audienceGrowthRate >= 0 ? '+' : ''}${audienceGrowthRate.toFixed(1)}%).`,
    previousAudience ? `Follower growth ${audienceGrowthRate >= previousGrowthRate ? 'improved' : 'slowed'} by ${Math.abs(audienceGrowthRate - previousGrowthRate).toFixed(1)} percentage points versus last month.` : 'Add last month’s data to unlock month-on-month growth comparison.',
    `${monthlyContentFollows.toLocaleString()} cumulative follows are attributed to posts published this month. This is shown separately from account-level growth.`,
    `Follow conversion is ${followConversion.toFixed(2)}%, while ${profileVisitRate.toFixed(2)}% of reached users visited the profile and ${linkConversion.toFixed(2)}% of profile visitors clicked through.`,
    audienceDraft.primaryAge || audienceDraft.topLocations ? `Core audience: ${audienceDraft.primaryAge || 'age not added'}${audienceDraft.topLocations ? ` · strongest locations: ${audienceDraft.topLocations}` : ''}.` : 'Add age and location data to track who your content is attracting.',
    bestAudiencePlatform ? `${bestAudiencePlatform.platform} currently has the strongest follow conversion across the platforms filled for this month.` : 'Complete more platforms to compare audience quality.',
  ];
  const audienceAction = !audienceHasData ? 'Start with Total Follows and Unfollows for each weekly period.'
    : strongestAudienceWeek?.netGrowth > 0 ? `${strongestAudienceWeek.label} delivered the strongest account growth. Review what was published and promoted during that period.`
    : profileVisitRate < 1 ? 'Strengthen profile calls-to-action and make the account promise clearer in high-reach content.'
    : linkConversion < 5 ? 'Improve the profile bio and link offer so more profile visitors take the next step.'
    : `Prioritise content around ${audienceDraft.primaryAge || 'your strongest audience'}${audienceDraft.activeDay ? ` on ${audienceDraft.activeDay}${audienceDraft.activeTime ? ` around ${audienceDraft.activeTime}` : ''}` : ''}.`;

  function updateAudience(patch: Partial<AudienceSnapshot>) {
    audienceDirty.current = true;
    setAudienceDraft((current) => ({ ...current, ...patch }));
    setAudienceMessage('Saving changes…');
  }
  function updateAudienceWeek(weekIndex: number, patch: Partial<AudienceWeek>) {
    audienceDirty.current = true;
    setAudienceWeekDrafts((current) => current.map((item) => item.weekIndex === weekIndex ? { ...item, ...patch } : item));
    setAudienceMessage('Saving changes…');
  }
  async function persistAudience(silent = false): Promise<boolean> {
    if (!authUser || member?.role === 'viewer') return false;
    if (audienceDraft.endingFollowers < 0 || audienceDraft.startingFollowers < 0) { setAudienceError('Follower totals cannot be negative.'); return false; }
    setAudienceBusy(true);
    setAudienceError('');
    if (!silent) setAudienceMessage('Saving changes…');
    audienceDirty.current = false;
    const row = {
      id: audienceDraft.id || crypto.randomUUID(), brand, platform: audiencePlatform, month_key: `${audienceMonth}-01`,
      starting_followers: audienceDraft.startingFollowers, ending_followers: audienceDraft.endingFollowers, reach: audienceDraft.reach,
      profile_visits: audienceDraft.profileVisits, link_clicks: audienceDraft.linkClicks, non_follower_reach_pct: audienceDraft.nonFollowerReachPct,
      women_pct: audienceDraft.womenPct, men_pct: audienceDraft.menPct, primary_age: audienceDraft.primaryAge, top_locations: audienceDraft.topLocations,
      active_day: audienceDraft.activeDay, active_time: audienceDraft.activeTime, notes: audienceDraft.notes, updated_at: new Date().toISOString(), updated_by: authUser.id,
    };
    const weeklyRows = audienceWeekDrafts.map((item) => ({ id: item.id || crypto.randomUUID(), brand, platform: audiencePlatform, month_key: `${audienceMonth}-01`, week_index: item.weekIndex, total_follows: item.totalFollows, unfollows: item.unfollows, updated_at: new Date().toISOString(), updated_by: authUser.id }));
    const [monthlyResult, weeklyResult] = await Promise.all([
      supabase.from('audience_monthly').upsert(row, { onConflict: 'brand,platform,month_key' }).select().single(),
      supabase.from('audience_weekly').upsert(weeklyRows, { onConflict: 'brand,platform,month_key,week_index' }).select(),
    ]);
    setAudienceBusy(false);
    const error = monthlyResult.error || weeklyResult.error;
    if (error) { audienceDirty.current = true; setAudienceError(error.message.includes('audience_') ? 'Run the updated setup.sql once in Supabase, then try again.' : error.message); setAudienceMessage(''); return false; }
    const saved = normalizeAudience(monthlyResult.data as Record<string, unknown>);
    const savedWeeks = (weeklyResult.data || []).map((item) => normalizeAudienceWeek(item as Record<string, unknown>));
    setAudienceSnapshots((current) => [...current.filter((item) => !(item.month === saved.month && item.platform === saved.platform)), saved]);
    setAudienceWeeks((current) => [...current.filter((item) => !(item.month === audienceMonth && item.platform === audiencePlatform)), ...savedWeeks]);
    setAudienceMessage('All changes saved to cloud.');
    return true;
  }
  async function saveAudience(event: FormEvent) {
    event.preventDefault();
    await persistAudience();
  }
  async function changeAudienceMonth(value: string) {
    if (audienceDirty.current && !await persistAudience(true)) return;
    setAudienceMessage('');
    setAudienceMonth(value);
  }
  async function changeAudiencePlatform(value: Platform) {
    if (audienceDirty.current && !await persistAudience(true)) return;
    setAudienceMessage('');
    setAudiencePlatform(value);
  }

  async function persistEntry(entry: Entry) {
    if (!authUser) return;
    setSyncState('saving');
    const { error } = await supabase.from('content_entries').upsert(cloudRow(entry, brand, authUser.id));
    setSyncState(error ? 'error' : 'synced');
  }
  function openNew(date?: string) { if (member?.role === 'viewer') return; const next = emptyEntry(); if (date) next.date = date; setDraft(next); setActivePlatform('IG'); setShowForm(true); }
  function openEdit(entry: Entry) { if (member?.role === 'viewer') return; setDraft({ ...entry, platformData: structuredClone(entry.platformData) }); setActivePlatform(entry.platforms[0] || 'IG'); setShowForm(true); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.date || !draft.title.trim()) return;
    const saved = draft.id ? draft : { ...draft, id: crypto.randomUUID() };
    const nextEntries = draft.id ? entries.map((entry) => entry.id === draft.id ? saved : entry) : [...entries, saved];
    setEntries(nextEntries);
    setShowForm(false);
    void persistEntry(saved);
  }
  async function removeEntry() {
    const id = draft.id;
    const remaining = entries.filter((entry) => entry.id !== id);
    setEntries(remaining);
    setShowForm(false);
    setSyncState('saving');
    const { error } = await supabase.from('content_entries').delete().eq('id', id);
    setSyncState(error ? 'error' : 'synced');
  }
  async function importLocalEntries() {
    if (!authUser) return;
    const localText = window.localStorage.getItem(storageKey(brand))
      || (brand === 'hustle' ? window.localStorage.getItem('content-calendar-entries') : null);
    if (!localText) { setLocalImportCount(0); return; }
    try {
      const localEntries = (JSON.parse(localText) as Record<string, unknown>[]).map(normalizeEntry);
      setSyncState('saving');
      const { error } = await supabase.from('content_entries').upsert(localEntries.map((entry) => cloudRow(entry, brand, authUser.id)));
      if (error) { setSyncState('error'); return; }
      window.localStorage.setItem(`content-calendar-imported-${brand}`, 'true');
      setLocalImportCount(0);
      setSyncState('synced');
    } catch { setSyncState('error'); }
  }
  async function signInWithEmail(event: FormEvent) {
    event.preventDefault();
    const email = authEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setAuthError('Enter a valid email address.'); return; }
    if (!authPassword) { setAuthError('Enter your password.'); return; }
    setAuthError('');
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword });
    setAuthBusy(false);
    if (error) { setAuthError(error.message); return; }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    if (newPassword.length < 8) { setAccountError('Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setAccountError('The passwords do not match.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setAccountError(error.message); return; }
    setNewPassword('');
    setConfirmPassword('');
    setAccountMessage('Password updated successfully.');
  }
  async function signOut() {
    await supabase.auth.signOut();
    setShowTeam(false);
    setShowAccount(false);
    setEntries([]);
  }
  async function refreshTeam() {
    if (member?.role !== 'admin') return;
    const [memberResult, inviteResult] = await Promise.all([
      supabase.from('members').select('id,email,role,status,created_at').order('created_at'),
      supabase.from('invites').select('email,role,status,created_at').order('created_at'),
    ]);
    if (memberResult.error || inviteResult.error) {
      setTeamError(memberResult.error?.message || inviteResult.error?.message || 'Unable to load team.');
      return;
    }
    setMembers((memberResult.data || []) as Member[]);
    setInvites((inviteResult.data || []) as Invite[]);
  }
  async function addTeamMember(event: FormEvent) {
    event.preventDefault();
    if (member?.role !== 'admin') return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setTeamError('Enter a valid email address.'); return; }
    setTeamError('');
    const existing = members.find((item) => item.email === email);
    const result = existing
      ? await supabase.from('members').update({ role: inviteRole, status: 'active' }).eq('id', existing.id)
      : await supabase.from('invites').upsert({ email, role: inviteRole, status: 'active', created_by: authUser?.id });
    if (result.error) { setTeamError(result.error.message); return; }
    setInviteEmail('');
    await refreshTeam();
  }
  async function updateTeamRole(kind: 'member' | 'invite', id: string, role: Role) {
    const result = kind === 'member'
      ? await supabase.from('members').update({ role }).eq('id', id)
      : await supabase.from('invites').update({ role }).eq('email', id);
    if (result.error) setTeamError(result.error.message);
    else await refreshTeam();
  }
  async function removeTeamAccess(kind: 'member' | 'invite', id: string) {
    if (kind === 'member' && id === authUser?.id) { setTeamError('You cannot deactivate your own admin account.'); return; }
    const result = kind === 'member'
      ? await supabase.from('members').update({ status: 'inactive' }).eq('id', id)
      : await supabase.from('invites').delete().eq('email', id);
    if (result.error) setTeamError(result.error.message);
    else await refreshTeam();
  }
  function openAdminPasswordReset(target: Member) {
    setResetMember(target);
    setAdminPassword('');
    setAdminPasswordConfirm('');
    setResetPasswordError('');
  }
  async function resetTeamMemberPassword(event: FormEvent) {
    event.preventDefault();
    if (member?.role !== 'admin' || !resetMember) return;
    setResetPasswordError('');
    if (adminPassword.length < 8) { setResetPasswordError('Use at least 8 characters.'); return; }
    if (adminPassword !== adminPasswordConfirm) { setResetPasswordError('The passwords do not match.'); return; }
    setResetPasswordBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setResetPasswordBusy(false);
      setResetPasswordError('Your session has expired. Please sign in again.');
      return;
    }
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: resetMember.id, password: adminPassword }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setResetPasswordError(result.error || 'Unable to reset password.'); return; }
      setTeamMessage(`Password updated for ${resetMember.email}. Share it securely.`);
      setResetMember(null);
      setAdminPassword('');
      setAdminPasswordConfirm('');
    } catch {
      setResetPasswordError('Unable to reach the server. Please try again.');
    } finally {
      setResetPasswordBusy(false);
    }
  }
  function togglePlatform(platform: Platform) {
    const included = draft.platforms.includes(platform);
    const nextPlatforms = included ? draft.platforms.filter((item) => item !== platform) : [...draft.platforms, platform];
    setDraft({ ...draft, platforms: nextPlatforms });
    if (!included) setActivePlatform(platform);
    else if (activePlatform === platform) setActivePlatform(nextPlatforms[0] || 'IG');
  }
  function updateInsight(platform: Platform, patch: Partial<Insight>) {
    setDraft({ ...draft, platformData: { ...draft.platformData, [platform]: { ...draft.platformData[platform], ...patch } } });
  }
  function applyAnalyticsPreset(preset: 'last7' | 'last30') {
    const end = today();
    setAnalyticsPreset(preset);
    setAnalyticsEnd(end);
    setAnalyticsStart(addDays(end, preset === 'last7' ? -6 : -29));
  }
  function updateLemon8Week(weekStart: string, patch: Partial<Lemon8Week>) {
    setLemon8Weeks((current) => {
      const existing = current.find((week) => week.weekStart === weekStart);
      return existing
        ? current.map((week) => week.weekStart === weekStart ? { ...week, ...patch } : week)
        : [...current, { weekStart, reads: 0, likesAndSaves: 0, follows: 0, ...patch }];
    });
    setLemon8Message('Unsaved changes');
    setLemon8Error('');
  }
  async function saveLemon8Performance() {
    if (!authUser || member?.role === 'viewer') return;
    setLemon8Busy(true);
    setLemon8Error('');
    const visibleStarts = new Set(lemon8ReportRows.map((week) => week.weekStart));
    const rows = lemon8Weeks.filter((week) => visibleStarts.has(week.weekStart)).map((week) => ({
      brand, week_start: week.weekStart, reads: week.reads, likes_and_saves: week.likesAndSaves, follows: week.follows,
      updated_at: new Date().toISOString(), updated_by: authUser.id,
    }));
    const { error } = rows.length ? await supabase.from('lemon8_weekly_performance').upsert(rows, { onConflict: 'brand,week_start' }) : { error: null };
    setLemon8Busy(false);
    if (error) { setLemon8Error('Run the updated setup.sql once in Supabase, then save again.'); setLemon8Message(''); return; }
    setLemon8Message('Weekly performance saved to cloud.');
  }
  const monthKey = (day: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const syncLabel = syncState === 'loading' ? 'Connecting…' : syncState === 'saving' ? 'Saving…' : syncState === 'error' ? 'Sync failed' : 'Cloud synced';
  const activeViralScore = platformViralScore(draft.platformData[activePlatform], activePlatform, entries, draft.id);
  const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const metricCard = (label: string, metric: keyof AnalyticsTotals) => ({ label, value: compactNumber.format(analyticsTotals[metric]), current: analyticsTotals[metric], previous: comparisonTotals[metric] });
  const analyticsCards = analyticsPlatform === 'YouTube' ? [metricCard('Views', 'views'), metricCard('Subscribers', 'follows'), metricCard('Published posts', 'posts')]
    : analyticsPlatform === 'Lemon8' ? [metricCard('Reads', 'views'), metricCard('Likes & Saves', 'interactions'), metricCard('Follows', 'follows'), metricCard('Published posts', 'posts')]
    : analyticsPlatform === 'IG' || analyticsPlatform === 'TikTok' ? [metricCard('Views', 'views'), metricCard('Interactions', 'interactions'), { label: 'Engagement rate', value: `${analyticsTotals.engagementRate.toFixed(1)}%`, current: analyticsTotals.engagementRate, previous: comparisonTotals.engagementRate }, metricCard('Follows', 'follows'), metricCard('Published posts', 'posts')]
    : [metricCard('Views / reads', 'views'), metricCard('Engagement actions', 'interactions'), metricCard('Audience gained', 'follows'), metricCard('Published posts', 'posts')];
  const analyticsMetricOptions: { value: AnalyticsMetric; label: string }[] = analyticsPlatform === 'YouTube'
    ? [{ value: 'views', label: 'Views' }, { value: 'follows', label: 'Subscribers' }]
    : analyticsPlatform === 'Lemon8'
      ? [{ value: 'views', label: 'Reads' }, { value: 'interactions', label: 'Likes & Saves' }, { value: 'follows', label: 'Follows' }]
      : analyticsPlatform === 'IG' || analyticsPlatform === 'TikTok'
        ? [{ value: 'views', label: 'Views' }, { value: 'interactions', label: 'Interactions' }, { value: 'follows', label: 'Follows' }, { value: 'engagementRate', label: 'Engagement rate' }]
        : [{ value: 'views', label: 'Views / reads' }, { value: 'interactions', label: 'Engagement actions' }, { value: 'follows', label: 'Audience gained' }];
  const analyticsMetricLabel = analyticsMetricOptions.find((option) => option.value === analyticsMetric)?.label || analyticsMetricOptions[0].label;

  if (authStatus === 'loading') return <main className="auth-shell"><div className="auth-card"><span className="auth-spark">✦</span><h1>Content Flow</h1><p>Connecting your workspace…</p></div></main>;

  if (authStatus === 'signed-out') return <main className="auth-shell login-shell">
    <section className="login-card">
      <div className="login-brand-panel">
        <div className="login-brand-lockup"><span>✦</span><strong>hustle.</strong><i>×</i><b>THE SECOND STUDIO</b></div>
        <div className="login-message">
          <p>CONTENT OPERATIONS, IN ONE PLACE</p>
          <h1>Keep every idea <em>moving.</em></h1>
          <span>Plan the story, move it through production, publish everywhere and learn what connects.</span>
        </div>
        <div className="login-preview" aria-hidden="true">
          <div className="preview-top"><span>August content</span><b>Cloud synced</b></div>
          <div className="preview-row"><i>12</i><div><strong>Founder story</strong><span>IG · TikTok</span></div><b>Ready</b></div>
          <div className="preview-row"><i>18</i><div><strong>Studio walkthrough</strong><span>YouTube · Lemon8</span></div><b>Editing</b></div>
        </div>
        <div className="login-benefits"><span>● Two brands</span><span>● One team</span><span>● Live cloud sync</span></div>
      </div>
      <div className="login-form-panel">
        <div className="login-form-heading"><span>SECURE WORKSPACE</span><h2>Welcome back.</h2><p>Sign in with the email and password provided by your admin.</p></div>
        <form className="email-login" onSubmit={(event) => void signInWithEmail(event)}><label htmlFor="login-email">Work email</label><input id="login-email" type="email" autoComplete="email" required placeholder="you@company.com" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required placeholder="Enter your password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /><button className="email-login-button" type="submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}<span>→</span></button></form>
        {authError && <small className="auth-error">{authError}</small>}
        <div className="login-access-note"><span>✓</span><p><strong>Admin-approved access</strong><small>Only invited team members can enter the calendar.</small></p></div>
      </div>
    </section>
  </main>;

  if (authStatus === 'denied') return <main className="auth-shell"><div className="auth-card"><span className="auth-spark">!</span><p className="eyebrow">ACCESS NOT APPROVED</p><h1>Ask your admin</h1><p><strong>{authUser?.email}</strong> is not currently allowed to enter this workspace.</p>{authError && <small className="auth-error">{authError}</small>}<button className="secondary-button" onClick={() => void signOut()}>Use another email</button></div></main>;

  return <main className="app-shell" data-brand={brand}>
    <header className="topbar">
      <div className="brand-area">
        {brand === 'hustle'
          ? <div className="brand hustle-brand"><span className="logo-crop"><img src="/hustle-logo.png" alt="hustle." /></span><small>Content calendar</small></div>
          : <div className="brand second-studio-brand"><span className="second-logo-crop"><img src="/second-studio-logo.png" alt="The Second Studio by Hustle" /></span><small>Content calendar</small></div>}
      </div>
      <div className="brand-switch" role="tablist" aria-label="Select brand">
        <button type="button" role="tab" aria-selected={brand === 'hustle'} className={brand === 'hustle' ? 'active' : ''} onClick={() => setBrand('hustle')}>hustle.</button>
        <button type="button" role="tab" aria-selected={brand === 'second-studio'} className={brand === 'second-studio' ? 'active' : ''} onClick={() => setBrand('second-studio')}>The Second Studio</button>
      </div>
      <div className="top-actions"><span className={`sync-pill ${syncState}`}>● {syncLabel}</span>{member?.role === 'admin' && <button className="account-button admin-settings-button" onClick={() => { setShowTeam(true); void refreshTeam(); }}>Admin settings</button>}<button className="account-button user-account" title={`${member?.email} · account settings`} onClick={() => { setShowAccount(true); setAccountError(''); setAccountMessage(''); }}>{member?.email.split('@')[0]} · {member?.role}</button>{member?.role !== 'viewer' && <button className="primary-button" onClick={() => openNew()}><span>＋</span> Add content</button>}</div>
    </header>

    {localImportCount > 0 && member?.role !== 'viewer' && <aside className="import-banner"><div><strong>Bring your existing content to the cloud</strong><span>{localImportCount} item{localImportCount === 1 ? '' : 's'} found on this device for {brand === 'hustle' ? 'hustle.' : 'The Second Studio'}.</span></div><button onClick={() => void importLocalEntries()}>Import to cloud</button></aside>}

    <section className="hero">
      <div><p className="eyebrow">{brand === 'hustle' ? 'HUSTLE CONTENT CALENDAR' : 'THE SECOND STUDIO CONTENT CALENDAR'}</p><h1>Keep every idea moving.</h1><p className="hero-copy">Plan once, publish everywhere, and compare what connects on every platform.</p></div>
      <div className="summary-grid">
        <div className="summary-card"><span>Scheduled</span><strong>{selectedMonthEntries.length}</strong><small>{summaryMonthLabel} posts</small></div>
        <div className="summary-card"><span>Ready</span><strong>{ready}</strong><small>in {summaryMonthLabel}</small></div>
        <div className="summary-card accent"><span>Published</span><strong>{published}</strong><small>in {summaryMonthLabel}</small></div>
        <div className="summary-card"><span>Best Performance Score</span><strong>{Math.round(bestScore)}</strong><small>{summaryMonthLabel} · out of 100</small></div>
      </div>
    </section>

    <section className="workspace">
      <div className="workspace-head">
        <div className="view-tabs"><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Content list</button><button className={view === 'insights' ? 'active' : ''} onClick={() => setView('insights')}>Insights</button><button className={view === 'audience' ? 'active' : ''} onClick={() => setView('audience')}>Audience</button></div>
        {view === 'calendar' && <div className="month-nav"><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><strong>{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</strong><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div>}
      </div>
      {(view === 'calendar' || view === 'list') && <div className="filters"><span>Show</span><select aria-label="Filter by platform" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as 'all' | Platform)}><option value="all">All platforms</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | StatusKey)}><option value="all">All statuses</option><option value="idea">Idea / Filming</option><option value="editing">Editing</option><option value="ready">Ready</option><option value="published">Published</option></select><small>{filteredEntries.length} content item{filteredEntries.length === 1 ? '' : 's'}</small></div>}

      {view === 'calendar' ? <div className="calendar-wrap">
        <div className="weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarDays.map((day, index) => day === null ? <div className="day empty" key={`empty-${index}`} /> : <button className="day" key={day} onClick={() => openNew(monthKey(day))}>
          <span className="day-number">{day}</span><div className="day-posts">{monthEntries.filter((entry) => entry.date === monthKey(day)).slice(0, 3).map((entry) => { const status = statusOf(entry); return <span className={`calendar-post status-${status.key}`} key={entry.id} onClick={(event) => { event.stopPropagation(); openEdit(entry); }}><b>{entry.hour}:{entry.minute}</b> {entry.title}</span>; })}</div>
        </button>)}</div>
      </div> : view === 'list' ? <div className="content-list">
        {filteredEntries.length === 0 ? <div className="empty-state"><span>✦</span><h2>{entries.length ? 'Nothing matches yet' : 'Your content starts here'}</h2><p>{entries.length ? 'Try another platform or status filter.' : 'Add your first idea and give it a date.'}</p>{!entries.length && member?.role !== 'viewer' && <button className="primary-button" onClick={() => openNew()}>Add content</button>}</div> : filteredEntries.slice().sort((a,b) => a.date.localeCompare(b.date)).map((entry) => {
          const rate = overallRate(entry); const score = overallViralScore(entry, entries); const status = statusOf(entry);
          const views = totalViews(entry);
          const interactions = entry.platforms.reduce((sum, platform) => sum + platformActions(entry.platformData[platform], platform), 0);
          return <article className="content-card" key={entry.id} onClick={() => openEdit(entry)}>
            <div className="date-block"><strong>{new Date(`${entry.date}T00:00:00`).getDate()}</strong><span>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en', { month: 'short' })}</span><small>{entry.hour}:{entry.minute}</small></div>
            <div className="content-main"><div className="card-title-row"><h3>{entry.title}</h3><div className="platforms-mini">{entry.platforms.map((platform) => <span className={entry.platformData[platform].postUrl ? 'posted' : ''} key={platform}>{entry.platformData[platform].postUrl ? '✓ ' : ''}{platform}</span>)}</div></div><div className="status-row"><span className={`status-badge ${status.key}`}>● {status.label}</span><span className={entry.filmed ? 'complete' : ''}>● Filming</span><span className={entry.edited ? 'complete' : ''}>● Editing</span></div><div className="rate-row"><div><span>Performance Score</span><strong>{views ? `${Math.round(score)}/100` : 'No data'}</strong></div><div className="progress"><span style={{ width: `${score}%` }} /></div><small>{views.toLocaleString()} views / reads · {rate.toFixed(1)}% action rate · {interactions.toLocaleString()} actions</small></div></div><span className="edit-arrow">›</span>
          </article>;
        })}
      </div> : view === 'insights' ? <section className="analytics-dashboard">
        <div className="analytics-header">
          <div><p className="eyebrow">PERFORMANCE OVERVIEW</p><h2>Content insights</h2><span>Metrics are grouped by each content item’s publish date.</span></div>
          <select aria-label="Insights platform" value={analyticsPlatform} onChange={(event) => { setAnalyticsPlatform(event.target.value as 'all' | Platform); setAnalyticsMetric('views'); }}><option value="all">All platforms</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select>
        </div>
        <div className="analytics-controls">
          <div className="preset-buttons"><button className={analyticsPreset === 'last7' ? 'active' : ''} onClick={() => applyAnalyticsPreset('last7')}>Last week</button><button className={analyticsPreset === 'last30' ? 'active' : ''} onClick={() => applyAnalyticsPreset('last30')}>Last month</button><button className={analyticsPreset === 'custom' ? 'active' : ''} onClick={() => setAnalyticsPreset('custom')}>Custom</button></div>
          <div className="date-range"><label><span>From</span><input type="date" value={analyticsStart} onChange={(event) => { setAnalyticsPreset('custom'); setAnalyticsStart(event.target.value); }} /></label><i>→</i><label><span>To</span><input type="date" value={analyticsEnd} min={analyticsStart} onChange={(event) => { setAnalyticsPreset('custom'); setAnalyticsEnd(event.target.value); }} /></label></div>
          <label className="compare-toggle"><input type="checkbox" checked={compareAnalytics} onChange={(event) => setCompareAnalytics(event.target.checked)} /><span>Compare previous period</span></label>
        </div>
        {analyticsPlatform === 'Lemon8' && <section className="lemon8-weekly-card">
          <div className="lemon8-weekly-head"><div><span>LEMON8 WEEKLY PERFORMANCE</span><h3>Enter the account totals shown by Lemon8</h3><p>Lemon8 does not provide reliable individual-post insights here. These weekly totals power the trend and Opportunity Map instead.</p></div><b>{lemon8ReportRows.length} week{lemon8ReportRows.length === 1 ? '' : 's'}</b></div>
          <div className="lemon8-weekly-table"><div className="lemon8-weekly-row labels"><span>Week</span><span>Reads</span><span>Likes & Saves</span><span>Follows</span><span>Published</span></div>{lemon8ReportRows.map((week) => <div className="lemon8-weekly-row" key={week.weekStart}><span className="lemon8-week-label"><strong>{new Date(`${week.weekStart}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</strong><small>– {new Date(`${week.weekEnd}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</small></span>{(['reads', 'likesAndSaves', 'follows'] as const).map((metric) => <label key={metric}><input aria-label={`Lemon8 ${metric} for week starting ${week.weekStart}`} type="number" min="0" disabled={member?.role === 'viewer'} value={week[metric] || ''} placeholder="0" onChange={(event) => updateLemon8Week(week.weekStart, { [metric]: Math.max(0, Number(event.target.value)) })} /></label>)}<strong className="lemon8-post-count">{week.posts}</strong></div>)}</div>
          <div className="lemon8-weekly-foot"><span>Published is calculated automatically from Lemon8 links in the Calendar.</span>{member?.role !== 'viewer' && <button type="button" className="primary-button" disabled={lemon8Busy} onClick={() => void saveLemon8Performance()}>{lemon8Busy ? 'Saving…' : 'Save weekly performance'}</button>}</div>
          {lemon8Error && <p className="team-error">{lemon8Error}</p>}{lemon8Message && <p className="account-success">{lemon8Message}</p>}
        </section>}
        <div className="analytics-kpis">{analyticsCards.map((card) => {
          const change = changeValue(card.current, card.previous);
          const positive = change !== null ? change >= 0 : card.current > 0;
          return <article className="analytics-kpi" key={card.label}><span>{card.label}</span><strong>{card.value}</strong>{compareAnalytics && <small className={positive ? 'up' : 'down'}>{change === null ? (card.current > 0 ? 'New' : '0%') : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`} <i>vs previous</i></small>}</article>;
        })}</div>
        {analyticsPlatform === 'all' && <div className="platform-momentum-card">
          <div className="chart-head momentum-head"><div><span>Platform opportunity map</span><small>One composite index using only the metrics selected for each platform · Benchmark uses the previous 4 matching periods.</small></div><div className="momentum-controls"><span className="opportunity-mode">Platform-specific average</span></div></div>
          <div className="opportunity-section">
            <div className="opportunity-star"><span>★ STAR CONCLUSION</span><h3>{starConclusion.title}</h3><p><b>Advice:</b> {starConclusion.advice}</p><small>Based on {analyticsStart} – {analyticsEnd} · compared with {comparisonStart} – {comparisonEnd}</small></div>
            <div className="opportunity-key"><span>🚀 <b>Scale</b> = increase output</span><span>🛡️ <b>Protect</b> = defend performance</span><span>🧪 <b>Test</b> = keep experimenting</span><span>🔧 <b>Fix</b> = change or reduce</span><small>Bubble size = current post count</small></div>
            <div className="opportunity-map" role="img" aria-label="Composite platform opportunity map">
              <div className="opportunity-quadrant protect"><strong>🛡️ PROTECT</strong><small>Strong · slowing</small></div><div className="opportunity-quadrant scale"><strong>🚀 SCALE</strong><small>Strong · growing</small></div><div className="opportunity-quadrant fix"><strong>🔧 FIX</strong><small>Weak · declining</small></div><div className="opportunity-quadrant test"><strong>🧪 TEST</strong><small>Weak · improving</small></div>
              <i className="opportunity-x-axis" /><i className="opportunity-y-axis" />
              <span className="opportunity-axis-label top">High performance</span><span className="opportunity-axis-label bottom">Low performance</span><span className="opportunity-axis-label left">Decline</span><span className="opportunity-axis-label right">Growth</span>
              {opportunityVisible.map((item) => {
                const left = 50 + (Math.max(-opportunityMomentumMax, Math.min(opportunityMomentumMax, item.momentum)) / opportunityMomentumMax) * 34;
                const boundedIndex = Math.max(20, Math.min(180, item.performanceIndex));
                const top = 50 - ((boundedIndex - 100) / 80) * 34;
                const size = 50 + Math.sqrt(item.contribution / opportunityContributionMax) * 30;
                const momentumLabel = `${item.momentum >= 0 ? '+' : ''}${item.momentum.toFixed(0)} pts`;
                return <button type="button" className={`opportunity-bubble ${item.quadrant}${item.lowConfidence ? ' low-confidence' : ''}`} style={{ left: `${left}%`, top: `${top}%`, width: `${size}px`, height: `${size}px` }} key={item.platform} onClick={() => setAnalyticsPlatform(item.platform)} aria-label={`${item.platform}: performance index ${Math.round(item.performanceIndex)}, momentum ${momentumLabel}`}><strong>{item.platform}</strong><small>{Math.round(item.performanceIndex)} index</small><em>{momentumLabel}</em>{item.lowConfidence && <i>Low confidence</i>}</button>;
              })}
            </div>
            <div className="opportunity-foot"><span><b>100 index</b> = median of the previous 4 matching periods</span><span>Momentum = current composite index minus previous-period index</span></div>
            <div className="opportunity-formula"><div><span>ⓘ</span><strong>How this is calculated</strong></div><p><b>Metric index</b> = current result ÷ median result from the previous 4 matching periods × 100. IG, TikTok and YouTube use per-post results; Lemon8 uses weekly account totals.</p><p><b>Composite index</b> = the average of that platform’s tracked metrics: <b>IG / TikTok</b> use Views, Likes, Shares, Saves and Follows; <b>YouTube</b> uses Views and Subscribers; <b>Lemon8</b> uses weekly Reads, combined Likes & Saves, and Follows. At least 2 metrics with enough history are required.</p><p><b>Momentum</b> = current composite index − previous-period composite index. <b>Bubble size</b> = posts published in the selected period.</p></div>
            {opportunityRecommendations.length > 0 && <div className="opportunity-conclusions"><div><span>RECOMMENDED ACTIONS</span><h4>What this map is telling you</h4></div>{opportunityRecommendations.map((item) => {
              const icon = item.quadrant === 'scale' ? '🚀' : item.quadrant === 'protect' ? '🛡️' : item.quadrant === 'test' ? '🧪' : '🔧';
              const title = item.quadrant === 'scale' ? 'Scale up' : item.quadrant === 'protect' ? 'Protect performance' : item.quadrant === 'test' ? 'Keep testing' : 'Fix or reduce';
              const explanation = item.quadrant === 'scale' ? `performance is ${Math.round(item.performanceIndex)} index and still improving` : item.quadrant === 'protect' ? `performance remains above normal at ${Math.round(item.performanceIndex)} index, but momentum fell ${Math.abs(item.momentum).toFixed(0)} points` : item.quadrant === 'test' ? `performance is below normal, but momentum improved ${item.momentum.toFixed(0)} points` : `performance is below normal and momentum fell ${Math.abs(item.momentum).toFixed(0)} points`;
              return <button type="button" key={item.platform} onClick={() => setAnalyticsPlatform(item.platform)}><i>{icon}</i><span><strong>{item.platform} · {title}</strong><small>{explanation}.{item.lowConfidence ? ' Treat as directional because the sample is limited.' : ''}</small></span><b>›</b></button>;
            })}</div>}
            {opportunityUnavailable.length > 0 && <div className="opportunity-unavailable"><strong>Not enough data</strong>{opportunityUnavailable.map((item) => <button type="button" key={item.platform} onClick={() => setAnalyticsPlatform(item.platform)}><span>{item.platform}</span><small>{item.isNew ? 'New platform · needs a previous-period benchmark' : item.platform === 'Lemon8' ? `${item.currentObservations} current weekly reports · ${item.previousObservations} previous · ${item.benchmarkPeriods} benchmark periods available` : `${item.currentPosts} current · ${item.previousPosts} previous · ${item.benchmarkPeriods} benchmark periods available`}</small><i>›</i></button>)}</div>}
          </div>
        </div>}
        <div className="analytics-chart-card">
          <div className="chart-head"><div><span>{analyticsMetricLabel} trend</span><small>{analyticsStart} – {analyticsEnd}{compareAnalytics ? ` · compared with ${comparisonStart} – ${comparisonEnd}` : ''}</small></div><select aria-label="Chart metric" value={analyticsMetric} onChange={(event) => setAnalyticsMetric(event.target.value as AnalyticsMetric)}>{analyticsMetricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          {analyticsBuckets.length ? <><div className="chart-legend"><span className="current">Current period</span>{compareAnalytics && <span className="previous">Previous period</span>}{viralSpikeIndex >= 0 && <span className="spike">Viral spike</span>}</div><div className="line-chart-stage"><div className="line-y-axis">{[1,.75,.5,.25,0].map((ratio) => <span key={ratio}>{chartTickValue(ratio)}</span>)}</div><div className="line-chart-main"><svg className="line-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${analyticsMetricLabel} trend chart`} preserveAspectRatio="none"><defs><linearGradient id="insightsLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff8a00"/><stop offset=".52" stopColor="#ff3e5f"/><stop offset="1" stopColor="#b622dc"/></linearGradient><linearGradient id="insightsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ed3c86" stopOpacity=".22"/><stop offset="1" stopColor="#b622dc" stopOpacity=".015"/></linearGradient></defs>{[0,.25,.5,.75,1].map((ratio) => <line className="line-grid" key={ratio} x1={chartPadding} x2={chartWidth - chartPadding} y1={chartPadding + ratio * (chartHeight - chartPadding * 2)} y2={chartPadding + ratio * (chartHeight - chartPadding * 2)} />)}{currentAreaPath && <path className="line-area" d={currentAreaPath} />}{compareAnalytics && previousChartPath && <path className="line-series previous" d={previousChartPath} />}{currentChartPath && <path className="line-series current" d={currentChartPath} />}{compareAnalytics && previousChartPoints.map((point, index) => <circle className="line-point previous" key={`previous-${index}`} cx={point.x} cy={point.y} r="4"><title>{`${analyticsBuckets[index].label} previous: ${analyticsMetric === 'engagementRate' ? `${point.value.toFixed(1)}%` : point.value.toLocaleString()}`}</title></circle>)}{currentChartPoints.map((point, index) => <g key={`current-${index}`}><circle className="line-point current" cx={point.x} cy={point.y} r={index === viralSpikeIndex ? 6 : 5}><title>{`${analyticsBuckets[index].label}: ${analyticsMetric === 'engagementRate' ? `${point.value.toFixed(1)}%` : point.value.toLocaleString()}`}</title></circle>{index === viralSpikeIndex && <g className="spike-marker"><circle cx={point.x} cy={point.y} r="13"/><rect x={Math.min(chartWidth - 105, Math.max(5, point.x - 44))} y={Math.max(4, point.y - 35)} width="88" height="21" rx="10"/><text x={Math.min(chartWidth - 61, Math.max(49, point.x))} y={Math.max(18, point.y - 21)} textAnchor="middle">Viral spike</text></g>}</g>)}</svg><div className="line-x-axis" style={{ gridTemplateColumns: `repeat(${analyticsBuckets.length}, minmax(0, 1fr))` }}>{analyticsBuckets.map((bucket) => <span key={bucket.label}>{bucket.label}</span>)}</div></div></div></> : <div className="analytics-empty">Choose a valid date range to see your chart.</div>}
        </div>
        <div className="analytics-breakdown">{analyticsPlatform === 'YouTube' ? <><div><span>Views</span><strong>{compactNumber.format(analyticsTotals.views)}</strong></div><div><span>Subscribers</span><strong>{compactNumber.format(analyticsTotals.follows)}</strong></div></> : analyticsPlatform === 'Lemon8' ? <><div><span>Reads</span><strong>{compactNumber.format(analyticsTotals.views)}</strong></div><div><span>Likes & Saves</span><strong>{compactNumber.format(analyticsTotals.interactions)}</strong></div><div><span>Follows</span><strong>{compactNumber.format(analyticsTotals.follows)}</strong></div></> : <><div><span>Likes</span><strong>{compactNumber.format(analyticsTotals.likes)}</strong></div><div><span>Shares</span><strong>{compactNumber.format(analyticsTotals.shares)}</strong></div><div><span>Saves</span><strong>{compactNumber.format(analyticsTotals.saves)}</strong></div><div><span>{analyticsPlatform === 'all' ? 'Audience gained' : 'Follows'}</span><strong>{compactNumber.format(analyticsTotals.follows)}</strong></div></>}</div>
        <section className="top-content-section">
          <div className="top-content-head"><div><span>{analyticsPlatform === 'Lemon8' ? 'CONTENT ATTRIBUTION' : 'TOP PERFORMERS'}</span><h3>{analyticsPlatform === 'Lemon8' ? 'Weekly data only' : 'Top 5 contents'}</h3><small>{analyticsPlatform === 'Lemon8' ? 'Lemon8 does not expose the single-post performance used by this report.' : `Ranked by platform-specific Performance Score for ${analyticsStart} – ${analyticsEnd}`}</small></div><b>{analyticsPlatform === 'all' ? 'All platforms' : analyticsPlatform}</b></div>
          {analyticsPlatform === 'Lemon8' ? <div className="top-content-empty lemon8-ranking-note"><strong>Individual content ranking is unavailable for Lemon8.</strong><span>Lemon8 performance is recorded as weekly account totals, so assigning those results to a single post would be misleading.</span></div> : topContents.length ? <div className="top-content-list">{topContents.map((item, index) => <article className="top-content-row" key={item.entry.id} onClick={() => openEdit(item.entry)}><span className={`rank rank-${index + 1}`}>{index + 1}</span><div className="top-content-info"><strong>{item.entry.title}</strong><small>{new Date(`${item.entry.date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })} · {item.selectedPlatforms.join(' · ')}</small></div><div className="top-content-metrics">{item.topMetrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><b>{metric.value}</b></span>)}</div><div className="top-content-score"><strong>{Math.round(item.score)}</strong><small>Performance Score</small><i><span style={{ width: `${item.score}%` }} /></i></div></article>)}</div> : <div className="top-content-empty">No published content with insights in this date range.</div>}
        </section>
      </section> : <section className="audience-dashboard">
        <div className="audience-header">
          <div><p className="eyebrow">MONTHLY AUDIENCE INTELLIGENCE</p><h2>Know who is growing with you.</h2><span>Enter monthly audience data for each platform. Content Flow saves automatically and calculates the story behind the numbers.</span></div>
          <label><span>Reporting month</span><input type="month" value={audienceMonth} max={currentMonth()} onChange={(event) => void changeAudienceMonth(event.target.value)} /></label>
        </div>
        <div className="audience-platforms">{platforms.map((platform) => { const item = audienceSnapshots.find((record) => record.month === audienceMonth && record.platform === platform); return <button type="button" className={audiencePlatform === platform ? 'active' : ''} key={platform} onClick={() => void changeAudiencePlatform(platform)}><span>{platform}</span><strong>{item ? `${audienceGrowth(item) >= 0 ? '+' : ''}${audienceGrowth(item).toFixed(1)}%` : 'Add data'}</strong><small>{item ? `${audienceNewFollowers(item) >= 0 ? '+' : ''}${audienceNewFollowers(item).toLocaleString()} followers` : audienceMonth}</small></button>; })}</div>
        <div className="audience-kpis">
          <article><span>Follower growth</span><strong>{audienceGrowthRate >= 0 ? '+' : ''}{audienceGrowthRate.toFixed(1)}%</strong><small>{audienceNew >= 0 ? '+' : ''}{audienceNew.toLocaleString()} net followers</small></article>
          <article><span>Follow conversion</span><strong>{followConversion.toFixed(2)}%</strong><small>new followers ÷ reach</small></article>
          <article><span>Profile visit rate</span><strong>{profileVisitRate.toFixed(2)}%</strong><small>profile visits ÷ reach</small></article>
          <article><span>Link conversion</span><strong>{linkConversion.toFixed(2)}%</strong><small>link clicks ÷ profile visits</small></article>
        </div>
        <div className="audience-layout">
          <form className="audience-form" onSubmit={(event) => void saveAudience(event)}>
            <div className="audience-section-head"><div><span>MONTHLY DATA</span><h3>{audiencePlatform} · {new Date(`${audienceMonth}-01T00:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3></div><b>{audienceBusy ? 'Saving…' : audienceDraft.id ? 'Cloud saved' : 'Auto-save on'}</b></div>
            <div className="audience-fields five"><label><span>Starting followers</span><input type="number" min="0" value={audienceDraft.startingFollowers || ''} onChange={(event) => updateAudience({ startingFollowers: Math.max(0, Number(event.target.value)) })} /></label><label><span>Ending followers</span><input type="number" min="0" value={audienceDraft.endingFollowers || ''} onChange={(event) => updateAudience({ endingFollowers: Math.max(0, Number(event.target.value)) })} /></label><label><span>Reach</span><input type="number" min="0" value={audienceDraft.reach || ''} onChange={(event) => updateAudience({ reach: Math.max(0, Number(event.target.value)) })} /></label><label><span>Profile visits</span><input type="number" min="0" value={audienceDraft.profileVisits || ''} onChange={(event) => updateAudience({ profileVisits: Math.max(0, Number(event.target.value)) })} /></label><label><span>Link clicks</span><input type="number" min="0" value={audienceDraft.linkClicks || ''} onChange={(event) => updateAudience({ linkClicks: Math.max(0, Number(event.target.value)) })} /></label></div>
            <div className="weekly-audience-head"><div><span>WEEKLY FOLLOWER TRACKING</span><h4>Enter the account-level Total Follows and Unfollows shown by the platform.</h4></div><div><span>Expected ending</span><strong>{expectedEndingFollowers.toLocaleString()}</strong>{audienceDraft.endingFollowers > 0 && <small className={reconciliationDifference === 0 ? 'match' : 'mismatch'}>{reconciliationDifference === 0 ? '✓ Matches actual' : `${reconciliationDifference > 0 ? '+' : ''}${reconciliationDifference.toLocaleString()} difference`}</small>}</div></div>
            <div className="weekly-audience-table"><div className="weekly-audience-row weekly-labels"><span>Period</span><span>Total follows</span><span>Unfollows</span><span>Net growth</span></div>{weeklyAudienceBreakdown.map((item) => <div className="weekly-audience-row" key={item.weekIndex}><span className="weekly-period"><b>{item.label}</b><small>{item.range}</small></span><label><input aria-label={`${item.label} total follows`} type="number" min="0" value={item.totalFollows || ''} placeholder="0" onChange={(event) => updateAudienceWeek(item.weekIndex, { totalFollows: Math.max(0, Number(event.target.value)) })} /></label><label><input aria-label={`${item.label} unfollows`} type="number" min="0" value={item.unfollows || ''} placeholder="0" onChange={(event) => updateAudienceWeek(item.weekIndex, { unfollows: Math.max(0, Number(event.target.value)) })} /></label><strong className={item.netGrowth >= 0 ? 'positive' : 'negative'}>{item.netGrowth >= 0 ? '+' : ''}{item.netGrowth.toLocaleString()}</strong></div>)}<div className="weekly-audience-row weekly-total"><span>Monthly total</span><strong>{monthlyTotalFollows.toLocaleString()}</strong><strong>{monthlyUnfollows.toLocaleString()}</strong><strong className={monthlyNetGrowth >= 0 ? 'positive' : 'negative'}>{monthlyNetGrowth >= 0 ? '+' : ''}{monthlyNetGrowth.toLocaleString()}</strong></div></div>
            <div className="weekly-legend"><span className="total">Total Follows</span><span className="unfollow">Unfollows</span><span className="net">Net Growth = Follows − Unfollows</span></div>
            <div className="audience-form-label">Audience mix</div>
            <div className="audience-fields demographics"><label><span>Women %</span><input type="number" min="0" max="100" step="0.1" value={audienceDraft.womenPct || ''} onChange={(event) => updateAudience({ womenPct: Math.min(100, Math.max(0, Number(event.target.value))) })} /></label><label><span>Men %</span><input type="number" min="0" max="100" step="0.1" value={audienceDraft.menPct || ''} onChange={(event) => updateAudience({ menPct: Math.min(100, Math.max(0, Number(event.target.value))) })} /></label><label><span>Primary age</span><select value={audienceDraft.primaryAge} onChange={(event) => updateAudience({ primaryAge: event.target.value })}><option value="">Select</option><option>13–17</option><option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option></select></label></div>
            <div className="audience-fields three"><label><span>Top locations</span><input placeholder="Singapore, Kuala Lumpur, Johor" value={audienceDraft.topLocations} onChange={(event) => updateAudience({ topLocations: event.target.value })} /></label><label><span>Most active day</span><select value={audienceDraft.activeDay} onChange={(event) => updateAudience({ activeDay: event.target.value })}><option value="">Select</option>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => <option key={day}>{day}</option>)}</select></label><label><span>Most active time range</span><input type="text" placeholder="6–9pm" value={audienceDraft.activeTime} onChange={(event) => updateAudience({ activeTime: event.target.value })} /></label></div>
            <label className="audience-notes"><span>Monthly notes</span><textarea rows={3} placeholder="Campaigns, audience changes or context worth remembering…" value={audienceDraft.notes} onChange={(event) => updateAudience({ notes: event.target.value })} /></label>
            {audienceError && <p className="team-error">{audienceError}</p>}{audienceMessage && <p className="account-success">{audienceMessage}</p>}
            {member?.role !== 'viewer' && <div className="audience-save"><span>Changes save automatically and stay available when you switch months or platforms.</span><button className="primary-button" type="submit" disabled={audienceBusy}>{audienceBusy ? 'Saving…' : 'Save now'}</button></div>}
          </form>
          <aside className="audience-analyst">
            <div className="analyst-title"><span>✦</span><div><p>AUDIENCE ANALYST</p><h3>What changed this month</h3></div></div>
            <div className="weekly-trend"><div className="weekly-trend-title"><span>Weekly account movement</span><small>Total · Unfollows · Net</small></div><div className="weekly-trend-chart">{weeklyAudienceBreakdown.map((item) => <div className="weekly-trend-group" key={item.weekIndex}><div><i className="total" style={{ height: `${(item.totalFollows / weeklyAudienceChartMax) * 100}%` }} /><i className="unfollow" style={{ height: `${(item.unfollows / weeklyAudienceChartMax) * 100}%` }} /><i className={`net ${item.netGrowth < 0 ? 'negative' : ''}`} style={{ height: `${(Math.abs(item.netGrowth) / weeklyAudienceChartMax) * 100}%` }} /></div><span>W{item.weekIndex}</span></div>)}</div></div>
            <div className="content-follow-ranking"><div className="content-follow-head"><div><span>CONTENT-ATTRIBUTED FOLLOWS</span><h4>Top posts this month</h4></div><strong>{monthlyContentFollows.toLocaleString()} cumulative</strong></div><p>Post-level attribution is cumulative and shown separately from account growth.</p>{audienceContentLeaders.length ? <div className="content-follow-leaders">{audienceContentLeaders.map((entry, index) => <article key={entry.id}><span>{index + 1}</span><div><strong>{entry.title}</strong><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</small></div><b>+{entry.platformData[audiencePlatform].follows.toLocaleString()}</b></article>)}</div> : <div className="content-follow-empty">No post-level follows recorded for {audiencePlatform} this month.</div>}</div>
            <div className="audience-funnel"><div><span>Reach</span><i><b style={{ width: audienceDraft.reach ? '100%' : '0%' }} /></i><strong>{compactNumber.format(audienceDraft.reach)}</strong></div><div><span>Profile visits</span><i><b style={{ width: `${Math.min(100, profileVisitRate)}%` }} /></i><strong>{compactNumber.format(audienceDraft.profileVisits)}</strong></div><div><span>Link clicks</span><i><b style={{ width: `${Math.min(100, audienceRate(audienceDraft.linkClicks, audienceDraft.reach))}%` }} /></i><strong>{compactNumber.format(audienceDraft.linkClicks)}</strong></div></div>
            <div className="analyst-insights">{audienceAnalysis.map((insight, index) => <p key={insight}><span>{index + 1}</span>{insight}</p>)}</div>
            <div className="analyst-action"><span>NEXT-MONTH ACTION</span><strong>{audienceAction}</strong></div>
            {audienceDraft.notes && <div className="analyst-note"><span>Your context</span><p>{audienceDraft.notes}</p></div>}
          </aside>
        </div>
      </section>}
    </section>

    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="editor" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-head"><div><p className="eyebrow">{draft.id ? 'EDIT CONTENT' : 'NEW CONTENT'}</p><h2>{draft.id ? 'Update your post' : 'Plan a new post'}</h2>{draft.id && <span className={`editor-status ${statusOf(draft).key}`}>{statusOf(draft).label}</span>}</div><button type="button" className="close" onClick={() => setShowForm(false)}>×</button></div>
      <label className="field full"><span>Content topic</span><input autoFocus required placeholder="Type your content idea..." value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <div className="date-time-row"><label className="field"><span>Publish date</span><input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><div className="field"><span>Publish time</span><div className="time-select"><select aria-label="Hour" value={draft.hour} onChange={(event) => setDraft({ ...draft, hour: event.target.value })}>{hours.map((hour) => <option key={hour}>{hour}</option>)}</select><b>:</b><select aria-label="Minute" value={draft.minute} onChange={(event) => setDraft({ ...draft, minute: event.target.value })}>{minutes.map((minute) => <option key={minute}>{minute}</option>)}</select></div></div></div>
      <div className="field full"><span>Platforms</span><div className="platform-picker">{platforms.map((platform) => <button type="button" className={draft.platforms.includes(platform) ? 'selected' : ''} key={platform} onClick={() => togglePlatform(platform)}><i>{draft.platforms.includes(platform) ? '✓' : '+'}</i>{platform}</button>)}</div></div>
      <label className="field full"><span>Reference video URL</span><input type="url" placeholder="https://..." value={draft.referenceUrl} onChange={(event) => setDraft({ ...draft, referenceUrl: event.target.value })} />{draft.referenceUrl && <a href={safeLink(draft.referenceUrl)} target="_blank" rel="noreferrer">Open reference ↗</a>}</label>
      <div className="field full"><span>Production status</span><div className="status-picker"><button type="button" className={draft.filmed ? 'selected' : ''} onClick={() => setDraft({ ...draft, filmed: !draft.filmed })}><i>{draft.filmed ? '✓' : ''}</i>Filming complete</button><button type="button" className={draft.edited ? 'selected' : ''} onClick={() => setDraft({ ...draft, edited: !draft.edited })}><i>{draft.edited ? '✓' : ''}</i>Editing complete</button></div></div>

      {(draft.id || draft.edited) && draft.platforms.length > 0 && <section className="publishing-section"><div className="section-title"><div><span>Published posts & insights</span><small>Each platform keeps its own URL and performance.</small></div><b>{publishedPlatforms(draft).length}/{draft.platforms.length} live</b></div><div className="platform-tabs">{draft.platforms.map((platform) => <button type="button" className={activePlatform === platform ? 'active' : ''} key={platform} onClick={() => setActivePlatform(platform)}>{draft.platformData[platform].postUrl ? '✓ ' : ''}{platform}</button>)}</div>
        {draft.platforms.includes(activePlatform) && <div className="platform-insights"><label className="field"><span>{activePlatform} post URL</span><input type="url" placeholder="Attach after publishing" value={draft.platformData[activePlatform].postUrl} onChange={(event) => updateInsight(activePlatform, { postUrl: event.target.value })} />{draft.platformData[activePlatform].postUrl && <a href={safeLink(draft.platformData[activePlatform].postUrl)} target="_blank" rel="noreferrer">View post ↗</a>}</label>{activePlatform === 'Lemon8' ? <div className="lemon8-post-note"><span>Weekly data</span><strong>No individual performance entry needed</strong><p>Reads, combined Likes & Saves, and Follows are entered once per week in Insights → Lemon8. This post link is still used to count how many Lemon8 posts were published.</p></div> : <div className="insights"><div className="insights-head"><div><span>{activePlatform} insights</span><small>Compared with your {activePlatform} content median</small></div><strong>{Math.round(activeViralScore)}/100</strong></div><div className="metrics">{platformMetrics[activePlatform].map((metric) => <label key={metric.key}><span>{metric.label}</span><input min="0" step={metric.step || 1} type="number" value={draft.platformData[activePlatform][metric.key] || ''} placeholder="0" onChange={(event) => updateInsight(activePlatform, { [metric.key]: Math.max(0, Number(event.target.value)) })} /></label>)}</div><div className="formula"><span style={{ width: `${activeViralScore}%` }} /><small>Performance Score · average vs your content median</small></div><p className="er-formula">Score = average of each tracked metric ÷ its {activePlatform} content median, capped at 100. {activePlatform === 'YouTube' ? 'Subscribers means subscribers gained from this content.' : `${insightRate(draft.platformData[activePlatform]).toFixed(1)}% ER = (Likes + Shares + Saves) ÷ Views × 100%.`}</p></div>}</div>}
      </section>}
      {!draft.id && !draft.edited && <div className="progressive-note"><span>✦</span><p><strong>Keep planning simple.</strong> Post URLs and insights appear once editing is complete.</p></div>}
      <div className="editor-actions">{draft.id && <button type="button" className="delete" onClick={() => void removeEntry()}>Delete</button>}<button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-button">{draft.id ? 'Save changes' : 'Add to calendar'}</button></div>
    </form></div>}

    {showAccount && <div className="modal-backdrop" onMouseDown={() => setShowAccount(false)}><section className="account-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-head"><div><p className="eyebrow">ACCOUNT</p><h2>Your sign-in</h2><span className="team-subtitle">{member?.email} · {member?.role}</span></div><button type="button" className="close" onClick={() => setShowAccount(false)}>×</button></div>
      <form className="password-form" onSubmit={(event) => void changePassword(event)}><div className="account-note"><span>✦</span><p><strong>Change your temporary password</strong><small>Use at least 8 characters and keep it private.</small></p></div><label className="field"><span>New password</span><input type="password" minLength={8} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label className="field"><span>Confirm new password</span><input type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{accountError && <p className="team-error">{accountError}</p>}{accountMessage && <p className="account-success">{accountMessage}</p>}<div className="account-actions"><button type="button" className="delete" onClick={() => void signOut()}>Sign out</button><button type="submit" className="primary-button">Update password</button></div></form>
    </section></div>}

    {showTeam && member?.role === 'admin' && <div className="modal-backdrop" onMouseDown={() => setShowTeam(false)}><section className="team-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-head"><div><p className="eyebrow">ADMIN SETTINGS</p><h2>Manage team access</h2><span className="team-subtitle">Only approved emails can enter Content Flow.</span></div><button type="button" className="close" onClick={() => setShowTeam(false)}>×</button></div>
      <form className="invite-form" onSubmit={addTeamMember}><label className="field"><span>Email address</span><input type="email" required placeholder="name@company.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label><label className="field"><span>Role</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)}><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><button className="primary-button" type="submit">Add access</button></form>
      <div className="admin-account-note"><span>1</span><p><strong>Approve the email here.</strong><small>Then create the same email with a temporary password in Supabase → Authentication → Users → Add user. Turn on Auto Confirm User.</small></p></div>
      {teamError && <p className="team-error">{teamError}</p>}
      {teamMessage && <p className="account-success">{teamMessage}</p>}
      <div className="role-guide"><span><b>Admin</b> manages people and content</span><span><b>Editor</b> updates content</span><span><b>Viewer</b> reads only</span></div>
      <div className="team-list"><div className="team-list-head"><span>People with access</span><small>{members.filter((item) => item.status === 'active').length + invites.filter((invite) => invite.status === 'active' && !members.some((item) => item.email === invite.email)).length} active</small></div>
        {members.map((item) => <article className={`team-row ${item.status}`} key={item.id}><div className="member-avatar">{item.email.slice(0, 1).toUpperCase()}</div><div className="member-info"><strong>{item.email}</strong><small>{item.id === authUser?.id ? 'You · Signed in' : item.status === 'active' ? 'Account connected' : 'Access inactive'}</small></div><select aria-label={`Role for ${item.email}`} value={item.role} disabled={item.id === authUser?.id && item.email === initialAdminEmail} onChange={(event) => void updateTeamRole('member', item.id, event.target.value as Role)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><div className="member-actions">{item.status === 'active' && item.id !== authUser?.id && <button className="reset-member-password" type="button" onClick={() => openAdminPasswordReset(item)}>Reset password</button>}<button className="remove-member" type="button" disabled={item.id === authUser?.id} onClick={() => void removeTeamAccess('member', item.id)}>{item.status === 'active' ? 'Deactivate' : 'Inactive'}</button></div></article>)}
        {invites.filter((invite) => !members.some((item) => item.email === invite.email)).map((invite) => <article className="team-row pending" key={invite.email}><div className="member-avatar">{invite.email.slice(0, 1).toUpperCase()}</div><div className="member-info"><strong>{invite.email}</strong><small>Approved · Waiting for first login</small></div><select aria-label={`Role for ${invite.email}`} value={invite.role} onChange={(event) => void updateTeamRole('invite', invite.email, event.target.value as Role)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="remove-member" type="button" onClick={() => void removeTeamAccess('invite', invite.email)}>Remove</button></article>)}
      </div>
    </section></div>}

    {resetMember && member?.role === 'admin' && <div className="modal-backdrop password-reset-backdrop" onMouseDown={() => !resetPasswordBusy && setResetMember(null)}><section className="account-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-head"><div><p className="eyebrow">ADMIN PASSWORD RESET</p><h2>Set a new password</h2><span className="team-subtitle">For {resetMember.email}</span></div><button type="button" className="close" disabled={resetPasswordBusy} onClick={() => setResetMember(null)}>×</button></div>
      <form className="password-form" onSubmit={(event) => void resetTeamMemberPassword(event)}><div className="account-note"><span>✦</span><p><strong>Create a temporary password</strong><small>The member can change it from their account menu after signing in.</small></p></div><label className="field"><span>New password</span><input type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label><label className="field"><span>Confirm new password</span><input type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={adminPasswordConfirm} onChange={(event) => setAdminPasswordConfirm(event.target.value)} /></label>{resetPasswordError && <p className="team-error">{resetPasswordError}</p>}<div className="account-actions"><button type="button" className="secondary-button" disabled={resetPasswordBusy} onClick={() => setResetMember(null)}>Cancel</button><button type="submit" className="primary-button" disabled={resetPasswordBusy}>{resetPasswordBusy ? 'Updating…' : 'Update password'}</button></div></form>
    </section></div>}
  </main>;
}
