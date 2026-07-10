import { useEffect, useRef, useState } from 'react';
import { getPublicConfig, researchVideos } from './api.js';
import { datesForPreset } from './datePresets.js';
import SearchForm from './components/SearchForm.jsx';
import Results from './components/Results.jsx';

const initialDates = datesForPreset('recent-3-months');

export default function App() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    niche: '', periodPreset: 'recent-3-months', ...initialDates,
    originalLanguage: 'any', languagePolicy: 'strict',
    discoveryMode: 'broad', minViews: '100000', format: 'all', region: 'US'
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef();

  useEffect(() => {
    const controller = new AbortController();
    getPublicConfig(controller.signal).then((value) => {
      setConfig(value);
      setForm((current) => ({
        ...current,
        region: value.defaultRegion,
        minViews: String(value.defaultMinViews),
        discoveryMode: value.defaultDiscoveryMode
      }));
    }).catch((reason) => {
      if (reason.name !== 'AbortError') setError(`Could not load server configuration: ${reason.message}`);
    });
    return () => controller.abort();
  }, []);

  async function submitSearch(values) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await researchVideos({
        niche: values.niche,
        startDate: values.startDate,
        endDate: values.endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        minViews: values.minViews,
        region: values.region,
        originalLanguage: values.originalLanguage,
        languagePolicy: values.originalLanguage === 'any' ? 'any' : values.languagePolicy,
        discoveryMode: values.discoveryMode,
        format: values.format
      }, controller.signal);
      setData(result);
    } catch (reason) {
      if (reason.name !== 'AbortError') setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!data?.meta.nextCursor) return;
    setLoadingMore(true);
    setError('');
    try {
      const next = await researchVideos({ cursor: data.meta.nextCursor });
      setData(next);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Maio YT AI Scout home"><span>MA</span> Maio YT AI Scout</a>
        <div className="local-pill"><i /> Local research workspace</div>
      </header>
      <main>
        <section className="hero">
          <span className="eyebrow">YouTube niche intelligence</span>
          <h1>Spot the videos that<br /><em>outperform the noise.</em></h1>
          <p>Search any niche. Surface recent videos over 100K views. Study what is already working.</p>
        </section>
        <SearchForm form={form} setForm={setForm} config={config} loading={loading} onSubmit={submitSearch} />
        {error && <div className="error-banner" role="alert"><strong>Research stopped.</strong> {error}</div>}
        <Results data={data} loadingMore={loadingMore} onLoadMore={loadMore} />
      </main>
      <footer>Maio YT AI Scout · Local YouTube research</footer>
    </div>
  );
}
