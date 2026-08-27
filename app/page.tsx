'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Platform = 'IG' | 'YouTube' | 'Lemon8' | 'TikTok';
type Brand = 'hustle' | 'second-studio';
type Insight = { postUrl: string; views: number; likes: number; shares: number; saves: number };
type Entry = {
  id: string; date: string; hour: string; minute: string; title: string;
  platforms: Platform[]; referenceUrl: string; filmed: boolean; edited: boolean;
  platformData: Record<Platform, Insight>;
};
type StatusKey = 'idea' | 'editing' | 'ready' | 'published';

const platforms: Platform[] = ['IG', 'YouTube', 'Lemon8', 'TikTok'];
const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const blankInsight = (): Insight => ({ postUrl: '', views: 0, likes: 0, shares: 0, saves: 0 });
const blankPlatformData = (): Record<Platform, Insight> => ({ IG: blankInsight(), YouTube: blankInsight(), Lemon8: blankInsight(), TikTok: blankInsight() });
const today = () => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); };
const emptyEntry = (): Entry => ({ id: '', date: today(), hour: '12', minute: '00', title: '', platforms: [], referenceUrl: '', filmed: false, edited: false, platformData: blankPlatformData() });
const insightRate = (data: Insight) => data.views ? ((data.likes + data.shares + data.saves) / data.views) * 100 : 0;
const publishedPlatforms = (entry: Entry) => entry.platforms.filter((platform) => entry.platformData[platform].postUrl);
const overallRate = (entry: Entry) => {
  const data = entry.platforms.map((platform) => entry.platformData[platform]);
  const views = data.reduce((sum, item) => sum + item.views, 0);
  const interactions = data.reduce((sum, item) => sum + item.likes + item.shares + item.saves, 0);
  return views ? (interactions / views) * 100 : 0;
};
const totalViews = (entry: Entry) => entry.platforms.reduce((sum, platform) => sum + entry.platformData[platform].views, 0);
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const benchmarkScore = (views: number, rate: number, samples: { views: number; rate: number }[]) => {
  if (!views) return 0;
  const valid = samples.filter((sample) => sample.views > 0);
  const viewMedian = median(valid.map((sample) => sample.views)) || views;
  const rateMedian = median(valid.map((sample) => sample.rate));
  const reachScore = Math.min(views / viewMedian, 1) * 100;
  const engagementScore = rateMedian > 0 ? Math.min(rate / rateMedian, 1) * 100 : rate > 0 ? 100 : 0;
  return (reachScore + engagementScore) / 2;
};
const overallViralScore = (entry: Entry, allEntries: Entry[]) => benchmarkScore(
  totalViews(entry),
  overallRate(entry),
  allEntries.filter((item) => item.id !== entry.id).map((item) => ({ views: totalViews(item), rate: overallRate(item) })),
);
const platformViralScore = (data: Insight, platform: Platform, allEntries: Entry[], currentId = '') => benchmarkScore(
  data.views,
  insightRate(data),
  allEntries.filter((entry) => entry.id !== currentId).map((entry) => ({ views: entry.platformData[platform].views, rate: insightRate(entry.platformData[platform]) })),
);
const statusOf = (entry: Entry): { key: StatusKey; label: string } => {
  if (publishedPlatforms(entry).length) return { key: 'published', label: 'Published' };
  if (entry.filmed && entry.edited) return { key: 'ready', label: 'Ready' };
  if (entry.filmed) return { key: 'editing', label: 'Editing' };
  return { key: 'idea', label: 'Idea / Filming' };
};
const safeLink = (value: string) => !value ? '' : /^https?:\/\//i.test(value) ? value : `https://${value}`;
const storageKey = (brand: Brand) => `content-calendar-entries-${brand}`;

function normalizeEntry(raw: Record<string, unknown>): Entry {
  const selected = Array.isArray(raw.platforms) ? raw.platforms.filter((item): item is Platform => platforms.includes(item as Platform)) : [];
  const data = blankPlatformData();
  const existing = raw.platformData as Partial<Record<Platform, Partial<Insight>>> | undefined;
  platforms.forEach((platform) => { if (existing?.[platform]) data[platform] = { ...data[platform], ...existing[platform] }; });
  if (!existing && selected[0]) {
    data[selected[0]] = {
      postUrl: String(raw.postUrl || ''), views: Number(raw.views || 0), likes: Number(raw.likes || 0),
      shares: Number(raw.shares || 0), saves: Number(raw.saves || 0),
    };
  }
  return {
    id: String(raw.id || crypto.randomUUID()), date: String(raw.date || today()), hour: String(raw.hour || '12'), minute: String(raw.minute || '00'),
    title: String(raw.title || ''), platforms: selected, referenceUrl: String(raw.referenceUrl || ''),
    filmed: Boolean(raw.filmed), edited: Boolean(raw.edited), platformData: data,
  };
}

export default function Home() {
  const [brand, setBrand] = useState<Brand>('hustle');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>(emptyEntry);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [activePlatform, setActivePlatform] = useState<Platform>('IG');
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');
  const [syncState, setSyncState] = useState<'loading' | 'saving' | 'saved'>('loading');
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });

  useEffect(() => {
    const preferred = window.localStorage.getItem('content-calendar-brand');
    if (preferred === 'hustle' || preferred === 'second-studio') setBrand(preferred);
  }, []);

  useEffect(() => {
    setSyncState('loading');
    window.localStorage.setItem('content-calendar-brand', brand);
    const saved = window.localStorage.getItem(storageKey(brand))
      || (brand === 'hustle' ? window.localStorage.getItem('content-calendar-entries') : null);
    let nextEntries: Entry[] = [];
    if (saved) {
      try { nextEntries = (JSON.parse(saved) as Record<string, unknown>[]).map(normalizeEntry); } catch { nextEntries = []; }
    }
    setEntries(nextEntries);
    setPlatformFilter('all');
    setStatusFilter('all');
    setShowForm(false);
    setSyncState('saved');
  }, [brand]);

  const filteredEntries = useMemo(() => entries.filter((entry) =>
    (platformFilter === 'all' || entry.platforms.includes(platformFilter)) &&
    (statusFilter === 'all' || statusOf(entry).key === statusFilter)
  ), [entries, platformFilter, statusFilter]);
  const monthEntries = useMemo(() => filteredEntries.filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }), [filteredEntries, month]);
  const calendarDays = useMemo(() => {
    const firstDay = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);
  const published = entries.filter((entry) => publishedPlatforms(entry).length).length;
  const ready = entries.filter((entry) => statusOf(entry).key === 'ready').length;
  const bestScore = entries.reduce((top, entry) => Math.max(top, overallViralScore(entry, entries)), 0);

  function persistEntries(nextEntries: Entry[]) {
    setSyncState('saving');
    window.localStorage.setItem(storageKey(brand), JSON.stringify(nextEntries));
    window.setTimeout(() => setSyncState('saved'), 180);
  }
  function openNew(date?: string) { const next = emptyEntry(); if (date) next.date = date; setDraft(next); setActivePlatform('IG'); setShowForm(true); }
  function openEdit(entry: Entry) { setDraft({ ...entry, platformData: structuredClone(entry.platformData) }); setActivePlatform(entry.platforms[0] || 'IG'); setShowForm(true); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.date || !draft.title.trim()) return;
    const saved = draft.id ? draft : { ...draft, id: crypto.randomUUID() };
    const nextEntries = draft.id ? entries.map((entry) => entry.id === draft.id ? saved : entry) : [...entries, saved];
    setEntries(nextEntries);
    setShowForm(false);
    persistEntries(nextEntries);
  }
  function removeEntry() {
    const id = draft.id;
    const remaining = entries.filter((entry) => entry.id !== id);
    setEntries(remaining);
    setShowForm(false);
    persistEntries(remaining);
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
  const monthKey = (day: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const syncLabel = syncState === 'loading' ? 'Loading…' : syncState === 'saving' ? 'Saving…' : 'Saved on this device';
  const activeViralScore = platformViralScore(draft.platformData[activePlatform], activePlatform, entries, draft.id);

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
      <div className="top-actions"><span className={`sync-pill ${syncState}`}>● {syncLabel}</span><button className="primary-button" onClick={() => openNew()}><span>＋</span> Add content</button></div>
    </header>

    <section className="hero">
      <div><p className="eyebrow">{brand === 'hustle' ? 'HUSTLE CONTENT CALENDAR' : 'THE SECOND STUDIO CONTENT CALENDAR'}</p><h1>Keep every idea moving.</h1><p className="hero-copy">Plan once, publish everywhere, and compare what connects on every platform.</p></div>
      <div className="summary-grid">
        <div className="summary-card"><span>Scheduled</span><strong>{entries.length}</strong><small>total posts</small></div>
        <div className="summary-card"><span>Ready</span><strong>{ready}</strong><small>ready to publish</small></div>
        <div className="summary-card accent"><span>Published</span><strong>{published}</strong><small>with post links</small></div>
        <div className="summary-card"><span>Best Viral Score</span><strong>{Math.round(bestScore)}</strong><small>out of 100</small></div>
      </div>
    </section>

    <section className="workspace">
      <div className="workspace-head">
        <div className="view-tabs"><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Content list</button></div>
        {view === 'calendar' && <div className="month-nav"><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><strong>{month.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</strong><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div>}
      </div>
      <div className="filters"><span>Show</span><select aria-label="Filter by platform" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as 'all' | Platform)}><option value="all">All platforms</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | StatusKey)}><option value="all">All statuses</option><option value="idea">Idea / Filming</option><option value="editing">Editing</option><option value="ready">Ready</option><option value="published">Published</option></select><small>{filteredEntries.length} content item{filteredEntries.length === 1 ? '' : 's'}</small></div>

      {view === 'calendar' ? <div className="calendar-wrap">
        <div className="weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarDays.map((day, index) => day === null ? <div className="day empty" key={`empty-${index}`} /> : <button className="day" key={day} onClick={() => openNew(monthKey(day))}>
          <span className="day-number">{day}</span><div className="day-posts">{monthEntries.filter((entry) => entry.date === monthKey(day)).slice(0, 3).map((entry) => { const status = statusOf(entry); return <span className={`calendar-post status-${status.key}`} key={entry.id} onClick={(event) => { event.stopPropagation(); openEdit(entry); }}><b>{entry.hour}:{entry.minute}</b> {entry.title}</span>; })}</div>
        </button>)}</div>
      </div> : <div className="content-list">
        {filteredEntries.length === 0 ? <div className="empty-state"><span>✦</span><h2>{entries.length ? 'Nothing matches yet' : 'Your content starts here'}</h2><p>{entries.length ? 'Try another platform or status filter.' : 'Add your first idea and give it a date.'}</p>{!entries.length && <button className="primary-button" onClick={() => openNew()}>Add content</button>}</div> : filteredEntries.slice().sort((a,b) => a.date.localeCompare(b.date)).map((entry) => {
          const rate = overallRate(entry); const score = overallViralScore(entry, entries); const status = statusOf(entry);
          const views = totalViews(entry);
          const interactions = entry.platforms.reduce((sum, platform) => { const item = entry.platformData[platform]; return sum + item.likes + item.shares + item.saves; }, 0);
          return <article className="content-card" key={entry.id} onClick={() => openEdit(entry)}>
            <div className="date-block"><strong>{new Date(`${entry.date}T00:00:00`).getDate()}</strong><span>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en', { month: 'short' })}</span><small>{entry.hour}:{entry.minute}</small></div>
            <div className="content-main"><div className="card-title-row"><h3>{entry.title}</h3><div className="platforms-mini">{entry.platforms.map((platform) => <span className={entry.platformData[platform].postUrl ? 'posted' : ''} key={platform}>{entry.platformData[platform].postUrl ? '✓ ' : ''}{platform}</span>)}</div></div><div className="status-row"><span className={`status-badge ${status.key}`}>● {status.label}</span><span className={entry.filmed ? 'complete' : ''}>● Filming</span><span className={entry.edited ? 'complete' : ''}>● Editing</span></div><div className="rate-row"><div><span>Viral Score</span><strong>{views ? `${Math.round(score)}/100` : 'No data'}</strong></div><div className="progress"><span style={{ width: `${score}%` }} /></div><small>{views.toLocaleString()} views · {rate.toFixed(1)}% ER · {interactions.toLocaleString()} interactions</small></div></div><span className="edit-arrow">›</span>
          </article>;
        })}
      </div>}
    </section>

    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="editor" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <div className="editor-head"><div><p className="eyebrow">{draft.id ? 'EDIT CONTENT' : 'NEW CONTENT'}</p><h2>{draft.id ? 'Update your post' : 'Plan a new post'}</h2>{draft.id && <span className={`editor-status ${statusOf(draft).key}`}>{statusOf(draft).label}</span>}</div><button type="button" className="close" onClick={() => setShowForm(false)}>×</button></div>
      <label className="field full"><span>Content topic</span><input autoFocus required placeholder="Type your content idea..." value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <div className="date-time-row"><label className="field"><span>Publish date</span><input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><div className="field"><span>Publish time</span><div className="time-select"><select aria-label="Hour" value={draft.hour} onChange={(event) => setDraft({ ...draft, hour: event.target.value })}>{hours.map((hour) => <option key={hour}>{hour}</option>)}</select><b>:</b><select aria-label="Minute" value={draft.minute} onChange={(event) => setDraft({ ...draft, minute: event.target.value })}>{minutes.map((minute) => <option key={minute}>{minute}</option>)}</select></div></div></div>
      <div className="field full"><span>Platforms</span><div className="platform-picker">{platforms.map((platform) => <button type="button" className={draft.platforms.includes(platform) ? 'selected' : ''} key={platform} onClick={() => togglePlatform(platform)}><i>{draft.platforms.includes(platform) ? '✓' : '+'}</i>{platform}</button>)}</div></div>
      <label className="field full"><span>Reference video URL</span><input type="url" placeholder="https://..." value={draft.referenceUrl} onChange={(event) => setDraft({ ...draft, referenceUrl: event.target.value })} />{draft.referenceUrl && <a href={safeLink(draft.referenceUrl)} target="_blank" rel="noreferrer">Open reference ↗</a>}</label>
      <div className="field full"><span>Production status</span><div className="status-picker"><button type="button" className={draft.filmed ? 'selected' : ''} onClick={() => setDraft({ ...draft, filmed: !draft.filmed })}><i>{draft.filmed ? '✓' : ''}</i>Filming complete</button><button type="button" className={draft.edited ? 'selected' : ''} onClick={() => setDraft({ ...draft, edited: !draft.edited })}><i>{draft.edited ? '✓' : ''}</i>Editing complete</button></div></div>

      {draft.id && draft.platforms.length > 0 && <section className="publishing-section"><div className="section-title"><div><span>Published posts & insights</span><small>Each platform keeps its own URL and performance.</small></div><b>{publishedPlatforms(draft).length}/{draft.platforms.length} live</b></div><div className="platform-tabs">{draft.platforms.map((platform) => <button type="button" className={activePlatform === platform ? 'active' : ''} key={platform} onClick={() => setActivePlatform(platform)}>{draft.platformData[platform].postUrl ? '✓ ' : ''}{platform}</button>)}</div>
        {draft.platforms.includes(activePlatform) && <div className="platform-insights"><label className="field"><span>{activePlatform} post URL</span><input type="url" placeholder="Attach after publishing" value={draft.platformData[activePlatform].postUrl} onChange={(event) => updateInsight(activePlatform, { postUrl: event.target.value })} />{draft.platformData[activePlatform].postUrl && <a href={safeLink(draft.platformData[activePlatform].postUrl)} target="_blank" rel="noreferrer">View post ↗</a>}</label><div className="insights"><div className="insights-head"><div><span>{activePlatform} insights</span><small>Compared with your {activePlatform} content median</small></div><strong>{Math.round(activeViralScore)}/100</strong></div><div className="metrics">{(['views','likes','shares','saves'] as const).map((metric) => <label key={metric}><span>{metric}</span><input min="0" type="number" value={draft.platformData[activePlatform][metric] || ''} placeholder="0" onChange={(event) => updateInsight(activePlatform, { [metric]: Math.max(0, Number(event.target.value)) })} /></label>)}</div><div className="formula"><span style={{ width: `${activeViralScore}%` }} /><small>Viral Score · 50% Reach + 50% ER</small></div><p className="er-formula">{insightRate(draft.platformData[activePlatform]).toFixed(1)}% ER = (Likes + Shares + Saves) ÷ Views × 100%</p></div></div>}
      </section>}
      {!draft.id && <div className="progressive-note"><span>✦</span><p><strong>Keep planning simple.</strong> Post URLs and insights appear after you add this idea to the calendar.</p></div>}
      <div className="editor-actions">{draft.id && <button type="button" className="delete" onClick={removeEntry}>Delete</button>}<button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-button">{draft.id ? 'Save changes' : 'Add to calendar'}</button></div>
    </form></div>}
  </main>;
}
