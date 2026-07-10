import { useMemo } from 'react';
import { datesForPreset, toLocalDateInput } from '../datePresets.js';

const PERIODS = [
  ['recent-3-months', 'Recent 3 months'],
  ['recent-30-days', 'Recent 30 days'],
  ['recent-6-months', 'Recent 6 months'],
  ['recent-12-months', 'Recent 12 months'],
  ['custom', 'Custom range']
];

export default function SearchForm({ form, setForm, config, loading, onSubmit }) {
  const presetDates = useMemo(() => datesForPreset(form.periodPreset), [form.periodPreset]);
  const isCustom = form.periodPreset === 'custom';
  const today = toLocalDateInput(new Date());

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const dates = form.periodPreset === 'recent-3-months'
      ? { startDate: undefined, endDate: undefined }
      : isCustom ? { startDate: form.startDate, endDate: form.endDate } : presetDates;
    onSubmit({ ...form, ...dates });
  }

  return (
    <form className="search-panel" onSubmit={submit}>
      <div className="niche-row">
        <label className="field niche-field">
          <span>Niche</span>
          <input
            value={form.niche}
            onChange={(event) => update('niche', event.target.value)}
            placeholder="e.g. interior design"
            minLength="2"
            maxLength="120"
            required
          />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? <><span className="spinner" /> Researching</> : 'Find outliers'}
        </button>
      </div>

      <div className="filters-grid">
        <label className="field">
          <span>Publication period</span>
          <select value={form.periodPreset} onChange={(event) => update('periodPreset', event.target.value)}>
            {PERIODS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>

        {isCustom && <>
          <label className="field">
            <span>Published from</span>
            <input type="date" max={form.endDate || today} value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required />
          </label>
          <label className="field">
            <span>Published through</span>
            <input type="date" min={form.startDate} max={today} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} required />
          </label>
        </>}

        <label className="field">
          <span>Original language</span>
          <select value={form.originalLanguage} onChange={(event) => update('originalLanguage', event.target.value)}>
            {(config?.languages ?? [{ code: 'any', name: 'Any language' }]).map((language) => (
              <option value={language.code} key={language.code}>{language.name}</option>
            ))}
          </select>
          <small>Uses YouTube's declared default audio language.</small>
        </label>

        <label className="field">
          <span>Language match</span>
          <select
            disabled={form.originalLanguage === 'any'}
            value={form.originalLanguage === 'any' ? 'any' : form.languagePolicy}
            onChange={(event) => update('languagePolicy', event.target.value)}
          >
            <option value="any">Not applicable</option>
            <option value="strict">Strict — declared only</option>
            {config?.bestEffortLanguageEnabled && <option value="best-effort">Best effort</option>}
          </select>
        </label>

        <label className="field">
          <span>Discovery depth</span>
          <select value={form.discoveryMode} onChange={(event) => update('discoveryMode', event.target.value)}>
            <option value="focused">Focused · 1 query</option>
            <option value="broad">Broad · up to {config?.maxQueryVariants ?? 3} queries</option>
            {config?.aiDiscoveryEnabled && <option value="ai">AI-assisted · Ollama</option>}
          </select>
          <small>{form.discoveryMode === 'ai' ? `Local ${config?.aiModel ?? 'Ollama'} expands and checks relevance.` : 'Broad mode improves recall but uses more search quota.'}</small>
        </label>

        <label className="field">
          <span>Minimum views</span>
          <input type="number" min="0" step="1000" value={form.minViews} onChange={(event) => update('minViews', event.target.value)} required />
        </label>

        <label className="field">
          <span>Format</span>
          <select value={form.format} onChange={(event) => update('format', event.target.value)}>
            <option value="all">All videos</option>
            <option value="short">Short (up to 3 min)</option>
            <option value="long">Long (over 3 min)</option>
          </select>
        </label>

        <label className="field compact-field">
          <span>Region</span>
          <input value={form.region} onChange={(event) => update('region', event.target.value.toUpperCase())} pattern="[A-Z]{2}" maxLength="2" required />
        </label>
      </div>
    </form>
  );
}
