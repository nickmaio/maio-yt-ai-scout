function compact(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);
}

function duration(seconds) {
  if (!Number.isFinite(seconds)) return 'Unknown length';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function VideoCard({ video }) {
  const language = video.language?.normalizedAudioLanguage;
  const outlier = video.outlier;
  const scoreLabel = outlier?.label === 'top-1%-sample'
    ? 'Top 1% of sample'
    : outlier?.label === 'sample-high-performer' ? `Top ${(100 - outlier.percentile).toFixed(1)}% of sample` : 'Threshold match';
  return (
    <article className="video-card">
      <a className="thumbnail" href={video.youtubeUrl} target="_blank" rel="noreferrer">
        <img src={video.thumbnailUrl} alt="" loading="lazy" />
        <span>{duration(video.durationSeconds)}</span>
      </a>
      <div className="video-body">
        <div className="badges">
          <span className="outlier-badge">100K+ outlier</span>
          {outlier && <span className={outlier.sampleQualified && outlier.percentile >= 99 ? 'percentile-badge top' : 'percentile-badge'}>{scoreLabel}</span>}
          {outlier?.channelMultiplier && <span className="channel-badge">{outlier.channelMultiplier}× channel baseline</span>}
          <span>{video.format === 'short' ? 'Short' : 'Long-form'}</span>
          <span>{language ? language.toUpperCase() : 'Language unknown'}</span>
        </div>
        <h3><a href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title}</a></h3>
        <p className="channel">{video.channelTitle}</p>
        {video.aiRelevance && <p className="ai-reason"><strong>AI relevance {Math.round(video.aiRelevance.confidence * 100)}%</strong> · {video.aiRelevance.reason}</p>}
        <div className="metrics">
          <div><strong>{compact(video.viewCount)}</strong><span>views</span></div>
          <div><strong>{compact(video.viewsPerDay)}</strong><span>views/day</span></div>
          <div><strong>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(video.publishedAt))}</strong><span>published</span></div>
        </div>
        {outlier && <p className="score-detail">Outlier score {outlier.score}/100 · ranked against {outlier.cohortSize} {outlier.cohort} videos{outlier.channelBaselineSampleSize ? ` · channel baseline ${outlier.channelBaselineSampleSize} uploads` : ''}</p>}
      </div>
    </article>
  );
}
