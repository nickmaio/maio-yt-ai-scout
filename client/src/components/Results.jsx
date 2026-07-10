import VideoCard from './VideoCard.jsx';

export default function Results({ data, loadingMore, onLoadMore }) {
  if (!data) return (
    <section className="empty-state intro-state">
      <div className="radar-icon">◎</div>
      <h2>Find the videos breaking through</h2>
      <p>Choose a niche and discover recent videos that crossed your view threshold.</p>
    </section>
  );

  return (
    <section className="results-section">
      <div className="results-summary">
        <div>
          <span className="eyebrow">Research results</span>
          <h2>{data.meta.qualifyingCount} outliers found</h2>
          <p>
            {data.query.startDate} to {data.query.endDate} · {data.query.originalLanguage === 'any' ? 'Any language' : data.query.originalLanguage.toUpperCase()}
            {' · '}{data.query.discoveryMode === 'ai' ? 'AI-assisted discovery' : data.query.discoveryMode === 'broad' ? 'Broad discovery' : 'Focused discovery'}{data.meta.cached ? ' · Cached result' : ''}
          </p>
        </div>
        <div className="summary-stats">
          <div><strong>{data.meta.candidateCount}</strong><span>scanned</span></div>
          <div><strong>{data.meta.uniqueSampleSize}</strong><span>unique sample</span></div>
        </div>
      </div>

      <div className="research-notes">
        <span>Queries: {data.query.queryVariants.join(' · ')}</span>
        <span>Cohorts: {Object.entries(data.meta.cohortSizes).map(([name, count]) => `${name} ${count}`).join(' · ') || 'none'}</span>
        <span>Channel baselines: {data.meta.channelBaselineCoverage}</span>
        {data.query.ai?.requested && <span>Ollama: {data.query.ai.fallback ? 'deterministic fallback used' : `${data.query.ai.model} · expansion ${data.query.ai.expansionUsed ? 'on' : 'off'} · relevance ${data.query.ai.relevanceUsed ? 'on' : 'off'}`}</span>}
        {data.meta.uniqueSampleSize < data.meta.minimumPercentileSample && <span>Top-1% labels unlock at {data.meta.minimumPercentileSample} videos per cohort.</span>}
      </div>

      {data.items.length ? (
        <div className="video-grid">{data.items.map((video) => <VideoCard video={video} key={video.videoId} />)}</div>
      ) : (
        <div className="empty-state"><h3>No qualifying videos found</h3><p>Try a broader niche, longer period, any language, or a lower view threshold.</p></div>
      )}

      {data.meta.nextCursor && (
        <button className="secondary-button load-more" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? 'Loading…' : 'Scan one more page'}
        </button>
      )}
      <p className="disclaimer">{data.meta.disclaimer}</p>
    </section>
  );
}
