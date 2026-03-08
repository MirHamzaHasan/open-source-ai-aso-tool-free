/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, Suspense } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, AlertCircle, TrendingUp, Hash, Target, MessageSquare } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";

function AICheckInner() {
  const { lang, country, modelString } = useLocale();
  const [appId, setAppId] = useState("");
  const [storeType, setStoreType] = useState("play");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState("");

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  const initStore = searchParams.get("store");

  useEffect(() => {
    if (initId) setAppId(initId);
    if (initStore === "play" || initStore === "ios") setStoreType(initStore);
  }, [initId, initStore]);

  const handleAnalyze = async () => {
    if (!appId) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const storeEndpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      const localeQuery = `&lang=${lang}&country=${country}`;

      // 1. Fetch app metadata
      setLoadingStage("Fetching app metadata...");
      const metaRes = await fetch(`${storeEndpoint}?type=app&appId=${encodeURIComponent(appId)}${localeQuery}`);
      const metaData = await metaRes.json();
      if (!metaData.success) throw new Error(metaData.error || 'Failed to fetch app data');

      // 2. Fetch competitors
      setLoadingStage("Analyzing competitors...");
      let competitorTitles = '';
      try {
        const simRes = await fetch(`${storeEndpoint}?type=similar&appId=${encodeURIComponent(appId)}${localeQuery}`);
        const simData = await simRes.json();
        if (simData.success && simData.data) {
          competitorTitles = simData.data.slice(0, 10).map((c: any) => `${c.title} (${c.score ? Number(c.score).toFixed(1) + '★' : 'N/A'})`).join(' | ');
        }
      } catch {}

      // 3. Fetch reviews
      setLoadingStage("Mining reviews...");
      let reviewSnippets = '';
      try {
        const revRes = await fetch(`${storeEndpoint}?type=reviews&appId=${encodeURIComponent(appId)}${localeQuery}`);
        const revData = await revRes.json();
        if (revData.success && revData.data) {
          const reviews = Array.isArray(revData.data) ? revData.data : revData.data.data || [];
          reviewSnippets = reviews.slice(0, 15).map((r: any) => `[${r.score || r.rating || '?'}★] ${(r.text || r.content || '').substring(0, 120)}`).join('\n');
        }
      } catch {}

      // 4. Fetch Google Trends
      setLoadingStage("Checking Google Trends...");
      let trendsInfo = '';
      try {
        const trendKw = (metaData.data.title || '').split(/[:\-–|]/).pop()?.trim() || metaData.data.title || appId;
        const trendsRes = await fetch(`/api/google-trends?keyword=${encodeURIComponent(trendKw)}&geo=${country.toUpperCase()}`);
        const trendsData = await trendsRes.json();
        if (trendsData.success && trendsData.data) {
          trendsInfo = `Trend: ${trendsData.data.trendDirection} | Current Interest: ${trendsData.data.currentInterest}/100 | Peak: ${trendsData.data.peakInterest}/100 | Related: ${trendsData.data.relatedQueries.join(', ')}`;
        }
      } catch {}

      // 5. Fetch Reddit buzz
      setLoadingStage("Scanning Reddit...");
      let redditInfo = '';
      try {
        const redditRes = await fetch(`/api/reddit?query=${encodeURIComponent(metaData.data.title || appId)}&limit=5`);
        const redditData = await redditRes.json();
        if (redditData.success && redditData.data) {
          redditInfo = `Community Buzz: ${redditData.data.communityBuzz} | Avg Upvotes: ${redditData.data.avgUpvotes} | Posts: ${redditData.data.posts.map((p: any) => `[${p.subreddit} +${p.score}] ${p.title}`).join(' | ')}`;
        }
      } catch {}

      // 6. Send everything to AI
      setLoadingStage("AI is analyzing everything...");
      const [provider, model] = modelString.split(':');

      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'metadata',
          provider,
          model,
          data: {
            title: metaData.data.title,
            subtitle: metaData.data.summary || metaData.data.subtitle || "N/A",
            description: metaData.data.description || "N/A",
            rating: metaData.data.score || '',
            reviewCount: metaData.data.reviews || metaData.data.ratings || '',
            installs: metaData.data.installs || metaData.data.maxInstalls || '',
            recentChanges: metaData.data.recentChanges || '',
            competitorTitles,
            reviewSnippets,
            trendsInfo,
            redditInfo,
          }
        })
      });
      
      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error);

      setResult({ app: metaData.data, ai: aiData.data });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const scoreColor = (s: number) => s > 75 ? 'bg-emerald-500' : s > 50 ? 'bg-yellow-500' : 'bg-red-500';
  const scoreTextColor = (s: number) => s > 75 ? 'text-emerald-400' : s > 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-400" />
          AI Deep Check
        </h1>
        <p className="text-gray-400 text-lg">
          Full audit: App metadata + Competitors + Reviews + Google Trends + Reddit — all analyzed by AI.
        </p>
      </div>

      <div className="bg-gradient-to-br from-indigo-900/40 to-black border border-indigo-500/30 rounded-2xl p-6 backdrop-blur-xl group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-500" />
        
        <div className="relative z-10 flex flex-wrap lg:flex-nowrap gap-4">
          <div className="flex-1 relative min-w-[300px]">
            <input 
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="App ID (e.g. com.dracoarts.game)"
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
            />
          </div>
          <select 
            value={storeType}
            onChange={(e) => setStoreType(e.target.value)}
            className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-4 focus:ring-2 focus:ring-indigo-500 outline-none w-36 font-medium cursor-pointer"
          >
            <option value="play">Google Play</option>
            <option value="ios">App Store</option>
          </select>
          <button 
            disabled={loading || !appId}
            onClick={handleAnalyze}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-8 py-4 font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? loadingStage : 'Deep Audit'}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150 fill-mode-both">
          
          {/* Top Row: App Info + Score */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="flex flex-col items-center text-center">
                <img src={result.app.icon} alt="App Icon" className="w-24 h-24 rounded-2xl shadow-xl mb-4" referrerPolicy="no-referrer" />
                <h2 className="text-xl font-bold text-white mb-1">{result.app.title}</h2>
                <p className="text-sm text-gray-400 mb-2">{result.app.developer || result.app.developerId}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {result.app.score && <span>⭐ {Number(result.app.score).toFixed(1)}</span>}
                  {result.app.installs && <span>📥 {result.app.installs}</span>}
                </div>
                
                <div className="w-full relative py-6">
                  <svg className="w-full h-32 absolute inset-0 text-indigo-500/20" viewBox="0 0 100 50">
                     <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="125 125" className="origin-center -rotate-90" />
                     <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient)" strokeWidth="8" strokeDasharray={`${(result.ai.score / 100) * 125} 125`} className="origin-center -rotate-90 transition-all duration-1000 ease-out" />
                     <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="relative z-10 flex flex-col items-center justify-center mt-2">
                    <span className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-indigo-400 to-purple-400">
                      {result.ai.score}
                    </span>
                    <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase mt-1">Overall Score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Target className="w-4 h-4" /> Score Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {result.ai.scoreBreakdown && Object.entries(result.ai.scoreBreakdown).map(([key, val]: [string, any]) => {
                  const labels: Record<string, string> = { titleScore: '📝 Title', subtitleScore: '📌 Subtitle', descriptionScore: '📄 Description', keywordScore: '🔑 Keywords', competitiveScore: '⚔️ Competition', reviewScore: '⭐ Reviews', trendScore: '📈 Trends', communityScore: '👥 Community' };
                  const score = val?.score || 0;
                  return (
                    <div key={key} className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{labels[key] || key}</span>
                        <span className={`font-bold ${scoreTextColor(score)}`}>{score}/100</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full rounded-full transition-all duration-700 ${scoreColor(score)}`} style={{ width: `${score}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">{val?.comment}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Strengths and Weaknesses */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px]" />
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2 relative z-10">
                <CheckCircle2 className="w-5 h-5" /> Pros
              </h3>
              <ul className="space-y-2 relative z-10">
                {result.ai.strengths?.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300 text-sm bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-emerald-500 font-bold">{i + 1}.</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[40px]" />
              <h3 className="text-lg font-bold text-rose-400 mb-4 flex items-center gap-2 relative z-10">
                <AlertCircle className="w-5 h-5" /> Cons
              </h3>
              <ul className="space-y-2 relative z-10">
                {result.ai.weaknesses?.map((w: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300 text-sm bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-rose-500 font-bold">{i + 1}.</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Keywords Analysis */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Hash className="w-4 h-4" /> Current Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.ai.currentKeywords?.map((kw: string, i: number) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-white/5 text-gray-300 rounded-lg border border-white/10">{kw}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-6">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                ✨ Suggested Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.ai.suggestedKeywords?.map((kw: string, i: number) => (
                  <span key={i} className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">{kw}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking Strategies */}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
            <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> How to Rank Higher
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {result.ai.rankingStrategies?.map((s: any, i: number) => (
                <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-xl">
                  <p className="text-sm text-white font-bold mb-1">{i + 1}. {s.title}</p>
                  <p className="text-xs text-gray-400 leading-snug">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Insights Row */}
          <div className="grid lg:grid-cols-3 gap-4">
            {result.ai.competitorInsights && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">⚔️ Competitor Insights</p>
                <p className="text-xs text-gray-300 leading-relaxed">{result.ai.competitorInsights}</p>
              </div>
            )}
            {result.ai.communitySentiment && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">👥 Community Sentiment</p>
                <p className="text-xs text-gray-300 leading-relaxed">{result.ai.communitySentiment}</p>
              </div>
            )}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">💡 Quick Tips</p>
              <ul className="space-y-1">
                {result.ai.suggestions?.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AICheck() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <AICheckInner />
    </Suspense>
  );
}
