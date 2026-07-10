# Maio YT AI Scout

A local MERN application that finds and ranks high-view YouTube videos in any niche. Combines deterministic threshold filtering, broader discovery, metric snapshots, sampled-percentile scoring, optional local Ollama analysis, and channel-relative baselines.

## Features

- Niche search through YouTube Data API v3
- 100,000 minimum current views by default
- Strict declared-language filtering and an Any-language mode
- MongoDB-backed video and search-result cache
- One optional additional YouTube result page
- Focused discovery (one query) or broad discovery (up to three deterministic query variants)
- Deduplication across query variants and pages
- Hourly MongoDB metric snapshots for future view-growth analysis
- Separate short/long-form percentile cohorts and a transparent composite outlier score
- Top-1% labels only when a cohort reaches the configured minimum sample
- AI-assisted discovery with schema-constrained Ollama query expansion and relevance checks
- Automatic deterministic fallback when Ollama is unavailable, slow, or returns invalid data
- Channel-relative multipliers based on a bounded, cached sample of recent channel uploads
- Daily local search-call budget tracking
- Responsive React interface and clear partial-result disclosure
- All local keys and connection parameters in a JavaScript configuration module

The app reports matching videos found in ranked YouTube search results. It cannot guarantee every qualifying video on YouTube.

## Prerequisites

- Node.js 22+
- MongoDB running locally on `127.0.0.1:27017`
- A Google Cloud project with YouTube Data API v3 enabled
- A YouTube Data API key
- Ollama is optional; focused and broad modes work without it

## Configure

Create your private local configuration from the committed example:

```powershell
Copy-Item server\src\config\localConfig.example.js server\src\config\localConfig.js
```

Then open `server/src/config/localConfig.js` and replace:

```js
apiKey: 'PASTE_YOUTUBE_DATA_API_KEY_HERE'
```

All other local parameters are in the same file: MongoDB URI, host/ports, timezone, Ollama connection/model, AI limits, channel-baseline limits, default threshold, cache durations, and quota limits. No `.env` file is used.

## Install and run

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The API listens on <http://127.0.0.1:5000>.

## Checks

```powershell
npm test
npm run build
```

## API

```http
GET /api/research?niche=interior%20design&startDate=2026-04-10&endDate=2026-07-10&timeZone=Europe%2FMoscow&minViews=100000&region=US&originalLanguage=en&languagePolicy=strict&format=all
```

Add `discoveryMode=focused`, `discoveryMode=broad`, or `discoveryMode=ai`. Broad mode searches deterministic variants. AI mode asks the configured local Ollama model for schema-constrained variants and applies bounded relevance classification to threshold-qualified videos. Use the returned `meta.nextCursor` as `GET /api/research?cursor=...` to scan one additional page for every non-exhausted variant.

## Percentile limitation

When a channel baseline is available, the outlier score combines niche view percentile (50%), channel-relative multiplier percentile (30%), and view-velocity percentile (20%). Without a sufficient channel baseline it falls back to view percentile (70%) and velocity percentile (30%). Percentiles describe only the discovered sample. A “Top 1% of sample” label is withheld until the cohort reaches `minTopPercentileSample`.

## Language limitation

YouTube's `relevanceLanguage` only influences search ranking. Strict filtering happens after hydration using `snippet.defaultAudioLanguage`, which uploaders may omit. YouTube does not expose a guaranteed original-production-language field, so multi-audio and dubbed videos can remain ambiguous.
