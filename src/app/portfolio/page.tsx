/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { FolderHeart, Plus, Trash2, Search, BarChart2, Star, Loader2, MessageSquare, Target, PenTool, ShieldAlert, Sparkles, Trophy, Download, Upload } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { toast } from "sonner";

interface ScoreItem { score: number; comment: string; }
interface ReviewInsights { sentiment: string; topPraise: string; topComplaint: string; featureRequest: string; }
interface GrowthStrategy { title: string; detail: string; }

interface AuditResult {
  overallScore: number;
  scoreBreakdown: {
    titleOptimization: ScoreItem;
    subtitleOptimization: ScoreItem;
    descriptionQuality: ScoreItem;
    keywordCoverage: ScoreItem;
    competitivePosition: ScoreItem;
    reviewSentiment: ScoreItem;
  };
  currentKeywords: string[];
  suggestedNewKeywords: string[];
  competitorKeywordGaps: string[];
  reviewInsights: ReviewInsights;
  potential: string;
  growthStrategies: GrowthStrategy[];
}

interface TrackedApp {
  id: string;
  store: "play" | "ios";
  metadata?: any;
  customAnalysis?: AuditResult;
}

export default function Portfolio() {
  const { lang, country, modelString } = useLocale();
  const [apps, setApps] = useState<TrackedApp[]>([]);
  const [newAppId, setNewAppId] = useState("");
  const [newAppStore, setNewAppStore] = useState<"play" | "ios">("play");
  const [isAdding, setIsAdding] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const loadApps = async () => {
      setLoadingInitial(true);
      const saved = localStorage.getItem("draco_aso_portfolio");
      if (saved) {
        try {
          const parsed: TrackedApp[] = JSON.parse(saved);
          // Set immediately so UI renders fast
          setApps(parsed);
          setLoadingInitial(false);
          
          // Re-fetch live data in the background
          const updatedApps = await Promise.all(parsed.map(async (app) => {
             try {
                const endpoint = app.store === 'play' ? '/api/play-store' : '/api/app-store';
                const res = await fetch(`${endpoint}?type=app&appId=${encodeURIComponent(app.id)}&lang=${lang}&country=${country}`);
                const data = await res.json();
                if (data.success && data.data) {
                   return { ...app, metadata: data.data };
                }
             } catch (e) {
                console.error("Failed to refresh app", app.id, e);
             }
             return app;
          }));

          setApps(updatedApps);
          return;
        } catch (e) {
          console.error("Failed to parse portfolio", e);
        }
      }
      setLoadingInitial(false);
    };
    loadApps();
  }, [lang, country]);

  // Save to localStorage whenever apps array changes
  const saveToStorage = (newApps: TrackedApp[]) => {
    // Save metadata so the portfolio loads instantly, along with the expensive AI customAnalysis
    const stripped = newApps.map(app => ({ 
      id: app.id, 
      store: app.store, 
      metadata: app.metadata,
      customAnalysis: app.customAnalysis 
    })); 
    localStorage.setItem("draco_aso_portfolio", JSON.stringify(stripped));
  };

  const handleAddApp = async () => {
    if (!newAppId.trim()) return;
    if (apps.find(a => a.id === newAppId.trim() && a.store === newAppStore)) {
      toast.error("App already tracked!");
      return;
    }

    setIsAdding(true);
    try {
      const endpoint = newAppStore === 'play' ? '/api/play-store' : '/api/app-store';
      const res = await fetch(`${endpoint}?type=app&appId=${newAppId.trim()}&lang=${lang}&country=${country}`);
      const data = await res.json();

      if (!data.success) throw new Error("Failed to fetch app. Check ID and Store.");

      const newApp: TrackedApp = {
        id: newAppId.trim(),
        store: newAppStore,
        metadata: data.data
      };

      const updated = [...apps, newApp];
      setApps(updated);
      saveToStorage(updated);
      setNewAppId("");

    } catch (e: any) {
      toast.error(e.message || "Failed to add app");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = (id: string, store: string) => {
    const updated = apps.filter(a => !(a.id === id && a.store === store));
    setApps(updated);
    saveToStorage(updated);
  };

  const handleAnalyze = async (app: TrackedApp) => {
    setAnalyzingId(`${app.store}-${app.id}`);
    try {
      const [provider, model] = modelString.split(':');
      const localeQuery = `&lang=${lang}&country=${country}`;
      const storeEndpoint = app.store === 'play' ? '/api/play-store' : '/api/app-store';

      // 1. Fetch competitor titles
      let competitorTitles = '';
      try {
        const simRes = await fetch(`${storeEndpoint}?type=similar&appId=${encodeURIComponent(app.id)}${localeQuery}`);
        const simData = await simRes.json();
        if (simData.success && simData.data) {
          competitorTitles = simData.data.slice(0, 10).map((c: any) => `${c.title} (${c.score ? Number(c.score).toFixed(1) + '★' : 'N/A'})`).join(' | ');
        }
      } catch {} 

      // 2. Fetch recent reviews
      let reviewSnippets = '';
      try {
        const revRes = await fetch(`${storeEndpoint}?type=reviews&appId=${encodeURIComponent(app.id)}${localeQuery}`);
        const revData = await revRes.json();
        if (revData.success && revData.data) {
          const reviews = Array.isArray(revData.data) ? revData.data : revData.data.data || [];
          reviewSnippets = reviews.slice(0, 15).map((r: any) => `[${r.score || r.rating || '?'}★] ${(r.text || r.content || '').substring(0, 120)}`).join('\n');
        }
      } catch {}

      // 3. Fetch Google Trends data for the app title keyword
      let trendsInfo = '';
      try {
        const trendKw = (app.metadata?.title || '').split(/[:\-–|]/).pop()?.trim() || app.metadata?.title || app.id;
        const trendsRes = await fetch(`/api/google-trends?keyword=${encodeURIComponent(trendKw)}&geo=${country.toUpperCase()}`);
        const trendsData = await trendsRes.json();
        if (trendsData.success && trendsData.data) {
          trendsInfo = `Trend: ${trendsData.data.trendDirection} | Current Interest: ${trendsData.data.currentInterest}/100 | Peak: ${trendsData.data.peakInterest}/100 | Related: ${trendsData.data.relatedQueries.join(', ')}`;
        }
      } catch {}

      // 4. Fetch Reddit community buzz
      let redditInfo = '';
      try {
        const redditRes = await fetch(`/api/reddit?query=${encodeURIComponent(app.metadata?.title || app.id)}&limit=5`);
        const redditData = await redditRes.json();
        if (redditData.success && redditData.data) {
          redditInfo = `Community Buzz: ${redditData.data.communityBuzz} | Avg Upvotes: ${redditData.data.avgUpvotes} | Posts: ${redditData.data.posts.map((p: any) => `[${p.subreddit} +${p.score}] ${p.title}`).join(' | ')}`;
        }
      } catch {}

      // 5. Send all to AI
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'portfolio-audit',
          provider,
          model,
          data: {
             title: app.metadata?.title || '',
             subtitle: app.store === 'play' ? app.metadata?.summary || '' : app.metadata?.subtitle || '',
             description: app.metadata?.description || '',
             rating: app.metadata?.score || app.metadata?.rating || '',
             reviewCount: app.metadata?.reviews || app.metadata?.ratings || '',
             installs: app.metadata?.installs || app.metadata?.maxInstalls || '',
             recentChanges: app.metadata?.recentChanges || 'N/A',
             competitorTitles,
             reviewSnippets,
             trendsInfo,
             redditInfo,
          }
        })
      });

      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error || 'AI Analysis failed');

      const updatedApps = apps.map(a => {
        if (a.id === app.id && a.store === app.store) {
           return { ...a, customAnalysis: aiData.data };
        }
        return a;
      });
      setApps(updatedApps);
      saveToStorage(updatedApps);

    } catch(err: any) {
      toast.error("Analysis failed: " + err.message);
    } finally {
      setAnalyzingId(null);
    }
  };
  const exportPortfolio = () => {
    if (apps.length === 0) {
      toast.error("Portfolio is empty");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(apps));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `aso-portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success("Portfolio exported successfully!");
  };

  const importPortfolio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
         const imported = JSON.parse(event.target?.result as string);
         if (Array.isArray(imported)) {
            // Merge logic or simple overwrite
            setApps(imported);
            saveToStorage(imported);
            toast.success(`Imported ${imported.length} apps into portfolio!`);
         } else {
            throw new Error("Invalid format");
         }
      } catch (err) {
         toast.error("Failed to import portfolio. Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    // reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
            <FolderHeart className="w-8 h-8 text-fuchsia-400" />
            My Portfolio
          </h1>
          <p className="text-gray-400 text-lg">
            Track your apps and competitor rankings over time. Live data is fetched on load.
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={exportPortfolio} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" /> Export
           </button>
           <label className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" /> Import
              <input type="file" accept=".json" onChange={importPortfolio} className="hidden" />
           </label>
        </div>
      </div>

      {/* Add New App Control */}
      <div className="flex flex-wrap lg:flex-nowrap gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-400/10 rounded-full blur-[80px] pointer-events-none" />
        
        <input 
          type="text" 
          value={newAppId}
          onChange={(e) => setNewAppId(e.target.value)}
          placeholder="App ID to Track (e.g. com.example.game)"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all font-mono text-sm relative z-10 min-w-[200px]"
        />
        <select 
            value={newAppStore}
            onChange={(e) => setNewAppStore(e.target.value as any)}
            className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-fuchsia-500 outline-none w-36 font-medium cursor-pointer relative z-10"
          >
            <option value="play">Google Play</option>
            <option value="ios">App Store</option>
        </select>
        <button 
          onClick={handleAddApp}
          disabled={isAdding || !newAppId}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(232,121,249,0.3)] transition-transform hover:scale-105 active:scale-95 relative z-10 flex items-center gap-2"
        >
          {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Track App
        </button>
      </div>

      {/* Portfolio Grid */}
      {loadingInitial ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-20 border border-white/5 bg-white/5 rounded-2xl relative overflow-hidden">
          <FolderHeart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-300">No tools tracked yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mt-2">Add your own apps or competitors above to keep a close eye on their ASO performance.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div key={`${app.store}-${app.id}`} className="rounded-2xl border border-white/10 bg-white/5 bg-gradient-to-br hover:border-fuchsia-500/50 hover:bg-white/10 transition-all duration-300 overflow-hidden relative group">
              
              <button 
                 onClick={() => handleRemove(app.id, app.store)}
                 className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"
                 title="Remove from tracking"
              >
                 <Trash2 className="w-4 h-4" />
              </button>

              <div className="p-6 relative z-10">
                <div className="flex items-start gap-4 mb-4">
                  {app.metadata?.icon ? (
                    <img 
                      src={app.metadata.icon} 
                      alt={app.metadata?.title || 'App Icon'} 
                      className="w-16 h-16 rounded-2xl shadow-lg border border-white/10 object-cover" 
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {app.metadata ? '?' : '...'}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-lg leading-tight truncate">
                      {app.metadata?.title || 'Loading...'}
                    </h3>
                    <p className="text-xs text-gray-500 truncate mt-1">{app.id}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 uppercase tracking-wider">
                        {app.store === 'play' ? 'Play Store' : 'iOS'}
                      </span>
                      {app.metadata?.score && (
                        <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {Number(app.metadata.score).toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-6">
                   <Link href={`/keyword-planner?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <Search className="w-4 h-4 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Keywords</span>
                   </Link>
                   <Link href={`/keyword-hunter?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <Target className="w-4 h-4 text-rose-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Hunter</span>
                   </Link>
                   <Link href={`/listing-builder?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <PenTool className="w-4 h-4 text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Builder</span>
                   </Link>
                   <Link href={`/competitor-watch?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <ShieldAlert className="w-4 h-4 text-amber-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Rivals</span>
                   </Link>
                   <Link href={`/rank-tracker?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <Trophy className="w-4 h-4 text-yellow-500 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Ranks</span>
                   </Link>
                   <Link href={`/review-miner?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn">
                     <MessageSquare className="w-4 h-4 text-pink-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center">Reviews</span>
                   </Link>
                   <Link href={`/ai-check?id=${app.id}&store=${app.store}`} className="bg-black/40 hover:bg-black/60 border border-white/5 hover:border-indigo-500/50 rounded-xl p-3 flex flex-col items-center justify-center gap-2 transition-colors group/btn col-span-3 mt-1 py-4">
                     <Sparkles className="w-5 h-5 text-indigo-400 group-hover/btn:scale-110 transition-transform" />
                     <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest text-center">Full AI Deep Check</span>
                   </Link>
                </div>

                {/* AI ASO Audit Section */}
                <div className="mt-4 pt-4 border-t border-white/10">
                   {app.customAnalysis ? (
                      <div className="space-y-5">
                        {/* Header + Overall Score */}
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider flex items-center gap-2">
                               <BarChart2 className="w-3 h-3" /> Deep AI Audit
                            </h4>
                            <div className={`text-sm font-extrabold px-3 py-1 rounded-lg ${app.customAnalysis.overallScore > 75 ? 'bg-emerald-500/20 text-emerald-400' : app.customAnalysis.overallScore > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                               {app.customAnalysis.overallScore}/100
                            </div>
                        </div>

                        {/* Score Breakdown Bars */}
                        <div className="space-y-2 bg-black/30 rounded-xl p-3 border border-white/5">
                          {app.customAnalysis.scoreBreakdown && Object.entries(app.customAnalysis.scoreBreakdown).map(([key, val]) => {
                            const labels: Record<string, string> = { titleOptimization: 'Title', subtitleOptimization: 'Subtitle', descriptionQuality: 'Description', keywordCoverage: 'Keywords', competitivePosition: 'Competition', reviewSentiment: 'Reviews' };
                            const score = val?.score || 0;
                            return (
                              <div key={key} title={val?.comment || ''}>
                                <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                  <span>{labels[key] || key}</span>
                                  <span className="font-bold">{score}</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-700 ${score > 75 ? 'bg-emerald-500' : score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Keywords Section */}
                        <div className="grid grid-cols-1 gap-3">
                           <div>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Current Keywords</p>
                              <div className="flex flex-wrap gap-1">
                                {app.customAnalysis.currentKeywords?.map((kw, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-gray-300 rounded border border-white/5">{kw}</span>
                                ))}
                              </div>
                           </div>
                           <div>
                              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5">✨ Suggested New Keywords</p>
                              <div className="flex flex-wrap gap-1">
                                {app.customAnalysis.suggestedNewKeywords?.map((kw, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">{kw}</span>
                                ))}
                              </div>
                           </div>
                           <div>
                              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1.5">🎯 Competitor Keyword Gaps</p>
                              <div className="flex flex-wrap gap-1">
                                {app.customAnalysis.competitorKeywordGaps?.map((kw, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">{kw}</span>
                                ))}
                              </div>
                           </div>
                        </div>

                        {/* Review Insights */}
                        {app.customAnalysis.reviewInsights && (
                          <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2">
                            <p className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">💬 Review Insights</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-gray-500">Sentiment:</span> <span className="text-white font-medium">{app.customAnalysis.reviewInsights.sentiment}</span></div>
                              <div><span className="text-gray-500">Top Praise:</span> <span className="text-emerald-300">{app.customAnalysis.reviewInsights.topPraise}</span></div>
                              <div><span className="text-gray-500">Top Issue:</span> <span className="text-red-300">{app.customAnalysis.reviewInsights.topComplaint}</span></div>
                              <div><span className="text-gray-500">Feature Ask:</span> <span className="text-cyan-300">{app.customAnalysis.reviewInsights.featureRequest}</span></div>
                            </div>
                          </div>
                        )}

                        {/* Potential */}
                        <div>
                           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Market Potential</p>
                           <p className="text-xs text-gray-300 leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5">{app.customAnalysis.potential}</p>
                        </div>

                        {/* Growth Strategies */}
                        <div>
                           <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider mb-2">🚀 Growth Strategies</p>
                           <div className="space-y-2">
                             {app.customAnalysis.growthStrategies?.map((s, i) => (
                               <div key={i} className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                                 <p className="text-xs text-white font-bold mb-0.5">{i + 1}. {s.title}</p>
                                 <p className="text-[11px] text-gray-400 leading-snug">{s.detail}</p>
                               </div>
                             ))}
                           </div>
                        </div>

                        {/* Re-run button */}
                        <button 
                          onClick={() => handleAnalyze(app)}
                          disabled={analyzingId === `${app.store}-${app.id}`}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {analyzingId === `${app.store}-${app.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                          Re-run Audit
                        </button>
                      </div>
                   ) : (
                      <button 
                        onClick={() => handleAnalyze(app)}
                        disabled={analyzingId === `${app.store}-${app.id}`}
                        className="w-full bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                         {analyzingId === `${app.store}-${app.id}` ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Scraping Competitors & Reviews...</>
                         ) : (
                            <><Target className="w-3 h-3" /> Generate Deep AI Audit</>
                         )}
                      </button>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
