"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { Target, Loader2, Bot, Sparkles, Search, Copy, Hash, Download, ArrowUpDown } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function KeywordHunterInner() {
  const { lang, country, modelString } = useLocale();
  const [appId, setAppId] = useState("");
  const [storeType, setStoreType] = useState<"play" | "ios">("play");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<any[] | null>(null);
  const [listingSuggestions, setListingSuggestions] = useState<{title?: string; subtitle?: string; description?: string} | null>(null);
  const [middleLayers, setMiddleLayers] = useState<{trends: any; suggests: string[]} | null>(null);
  const [appMeta, setAppMeta] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  const initStore = searchParams.get("store");

  useEffect(() => {
    if (initId) setAppId(initId);
    if (initStore === "play" || initStore === "ios") setStoreType(initStore);
  }, [initId, initStore]);

  const handleHunt = async () => {
    if (!appId.trim()) return;
    setIsLoading(true);
    setError(null);
    setKeywords(null);
    setListingSuggestions(null);
    setMiddleLayers(null);
    setAppMeta(null);

    try {
      // 1. Fetch app metadata
      const localeQuery = `&lang=${lang}&country=${country}`;
      const storeEndpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      const appRes = await fetch(`${storeEndpoint}?type=app&appId=${appId}${localeQuery}`);
      const appData = await appRes.json();
      if (!appData.success) throw new Error(appData.error || 'Failed to fetch app details');
      setAppMeta(appData.data);

      // 2. Fetch similar apps for competitor intelligence
      const simRes = await fetch(`${storeEndpoint}?type=similar&appId=${appId}${localeQuery}`);
      const simData = await simRes.json();
      const similarTitles = simData.success ? (simData.data || []).slice(0, 10).map((a: any) => a.title).join(', ') : '';

      // 3. Middle Layer: Fetch Google Trends to deeply understand keyword seasonality & related terms
      let trendsInfo = '';
      let trendsRaw = null;
      try {
        const trendKw = (appData.data.title || '').split(/[:\-–|]/).pop()?.trim() || appData.data.title || appId;
        const trendsRes = await fetch(`/api/google-trends?keyword=${encodeURIComponent(trendKw)}&geo=${country.toUpperCase()}`);
        const trendsData = await trendsRes.json();
        if (trendsData.success && trendsData.data) {
          trendsRaw = trendsData.data;
          trendsInfo = `Trend: ${trendsData.data.trendDirection} | Current Interest: ${trendsData.data.currentInterest}/100 | Peak: ${trendsData.data.peakInterest}/100 | Related Top Queries: ${trendsData.data.relatedQueries.join(', ')}`;
        }
      } catch {}

      // 3.5 Middle Layer: Store Auto-Suggest (Google Keyword Tool Equivalent)
      let suggestInfo = '';
      let suggestsRaw: string[] = [];
      try {
        const titleKw = (appData.data.title || '').substring(0, 30);
        const sugRes = await fetch(`${storeEndpoint}?type=suggest&term=${encodeURIComponent(titleKw)}${localeQuery}`);
        const sugData = await sugRes.json();
        if (sugData.success && sugData.data) {
          suggestsRaw = sugData.data;
          suggestInfo = sugData.data.join(', ');
        }
      } catch {}

      setMiddleLayers({ trends: trendsRaw, suggests: suggestsRaw });

      // 4. Send everything to AI for deep keyword mining & listing generation
      const [provider, model] = modelString.split(':');
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'keyword-hunt',
          provider,
          model,
          data: {
            title: appData.data.title || '',
            subtitle: storeType === 'play' ? appData.data.summary || '' : appData.data.subtitle || '',
            description: appData.data.description || '',
            genre: appData.data.genre || appData.data.primaryGenre || '',
            similarApps: similarTitles,
            trendsInfo,
            suggestInfo,
            storeType,
          }
        })
      });
      
      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error || 'AI keyword mining failed');
      setKeywords(aiData.data.keywords || []);
      setListingSuggestions({
         title: aiData.data.suggestedTitle,
         subtitle: aiData.data.suggestedSubtitle,
         description: aiData.data.suggestedDescription
      });

    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Hunting failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAllKeywords = () => {
    if (!keywords) return;
    const text = keywords.map(k => k.keyword).join(', ');
    navigator.clipboard.writeText(text);
    toast.success("Keywords copied to clipboard!");
  };

  const exportToCSV = () => {
    if (!keywords || keywords.length === 0) return;
    
    let csvContent = "Keyword,Relevance,Difficulty,Strategy\\n";
    
    keywords.forEach(kw => {
      // Escape cells
      const keyword = `"${kw.keyword.replace(/"/g, '""')}"`;
      const strategy = `"${(kw.strategy || '').replace(/"/g, '""')}"`;
      csvContent += `${keyword},${kw.relevance},${kw.difficulty},${strategy}\\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `keyword-hunter-${appId || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Keywords exported to CSV!");
  };

  const sortedKeywords = useMemo(() => {
    if (!keywords) return [];
    let sortableItems = [...keywords];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Simple mapping for text-based scales
        const weight = (val: string) => {
          if (val === 'High' || val === 'Low') return 3; // High Rel, Low Diff are "best"
          if (val === 'Medium') return 2;
          return 1;
        };

        const aWeight = weight(a[sortConfig.key]);
        const bWeight = weight(b[sortConfig.key]);

        if (aWeight < bWeight) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aWeight > bWeight) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [keywords, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
           <Target className="w-8 h-8 text-rose-400" />
           Keyword Hunter
        </h1>
        <p className="text-gray-400 text-lg">
          Enter any app. AI will analyze its metadata, study its competitors, and mine a massive list of high-value keywords you should target.
        </p>
      </div>

      {/* Input Section */}
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-rose-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="grid md:grid-cols-4 gap-4 relative z-10">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">App ID / Package Name</label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder={storeType === 'play' ? "com.example.game" : "123456789"}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 outline-none focus:ring-2 focus:ring-rose-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Store</label>
            <select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
            >
              <option value="play">Google Play</option>
              <option value="ios">App Store</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{error}</div>
        )}

        <button
          onClick={handleHunt}
          disabled={isLoading || !appId}
          className="mt-6 w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] transition-all text-lg"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
          {isLoading ? 'Hunting Keywords...' : 'Hunt Keywords'}
        </button>
      </div>

      {/* Results */}
      {keywords && keywords.length > 0 && (
         <div className="space-y-6">
           {/* App Context Header */}
           {appMeta && (
              <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                {appMeta.icon && <img src={appMeta.icon} alt="" className="w-12 h-12 rounded-xl border border-white/10" referrerPolicy="no-referrer" />}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold truncate">{appMeta.title}</h3>
                  <p className="text-xs text-gray-500">{appMeta.genre || appMeta.primaryGenre} · {appId}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportToCSV}
                    className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    onClick={copyAllKeywords}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" /> Copy All ({keywords.length})
                  </button>
                </div>
              </div>
           )}

           {/* Middle Layers Visualization */}
           {middleLayers && (middleLayers.trends || (middleLayers.suggests && middleLayers.suggests.length > 0)) && (
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {middleLayers.trends && (
                   <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">📈</span>
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Google Trends Layer</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-500 mb-1">Current Interest</p>
                          <p className="text-lg font-bold text-white">{middleLayers.trends.currentInterest} / 100</p>
                        </div>
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-500 mb-1">Trajectory</p>
                          <p className="text-lg font-bold text-white capitalize">{middleLayers.trends.trendDirection}</p>
                        </div>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500 mb-2">Related Top Queries</p>
                        <div className="flex flex-wrap gap-2">
                          {middleLayers.trends.relatedQueries.map((q: string, i: number) => (
                             <span key={i} className="text-[10px] px-2 py-1 bg-white/5 text-gray-300 rounded border border-white/10">{q}</span>
                          ))}
                        </div>
                      </div>
                   </div>
                )}
                
                {middleLayers.suggests && middleLayers.suggests.length > 0 && (
                   <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🔍</span>
                        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Store Keyword Tool Layer</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                        Live autocomplete suggestions pulled directly from the store's search engine for the app's title, revealing exactly what users type.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {middleLayers.suggests.map((s: string, i: number) => (
                           <span key={i} className="text-xs px-2.5 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg border border-cyan-500/20">{s}</span>
                        ))}
                      </div>
                   </div>
                )}
              </div>
           )}

           {/* Listing Suggestions */}
           {listingSuggestions && (
             <div className="grid lg:grid-cols-3 gap-6 mb-6">
                 <div className="bg-gradient-to-br from-indigo-900/30 to-black border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-md">
                     <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-2">Optimized Title</p>
                     <p className="text-white font-medium">{listingSuggestions.title || 'N/A'}</p>
                 </div>
                 <div className="bg-gradient-to-br from-purple-900/30 to-black border border-purple-500/30 rounded-2xl p-5 backdrop-blur-md">
                     <p className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-2">Optimized Subtitle</p>
                     <p className="text-white font-medium leading-relaxed">{listingSuggestions.subtitle || 'N/A'}</p>
                 </div>
                 <div className="bg-gradient-to-br from-pink-900/30 to-black border border-pink-500/30 rounded-2xl p-5 backdrop-blur-md lg:col-span-3">
                     <p className="text-xs text-pink-400 font-bold uppercase tracking-wider mb-2">Optimized Description (Extract)</p>
                     <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{listingSuggestions.description || 'N/A'}</p>
                 </div>
             </div>
           )}

           {/* Keywords Table */}
           <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 backdrop-blur-md">
             <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/40 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-white/5">
               <div className="col-span-1">#</div>
               <div className="col-span-4">Keyword</div>
               <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('relevance')}>
                 Relevance <ArrowUpDown className="w-3 h-3" />
               </div>
               <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort('difficulty')}>
                 Difficulty <ArrowUpDown className="w-3 h-3" />
               </div>
               <div className="col-span-3">Strategy</div>
             </div>
             {sortedKeywords.map((kw, i) => (
               <div key={i} className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 hover:bg-white/5 transition-colors items-center">
                 <div className="col-span-1 text-xs text-gray-600 font-mono">{i + 1}</div>
                 <div className="col-span-4 text-white font-medium text-sm flex items-center gap-2">
                    <Hash className="w-3 h-3 text-rose-400/50" />
                    {kw.keyword}
                 </div>
                 <div className="col-span-2">
                   <span className={`text-xs font-bold px-2 py-0.5 rounded ${kw.relevance === 'High' ? 'bg-emerald-500/20 text-emerald-400' : kw.relevance === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                     {kw.relevance}
                   </span>
                 </div>
                 <div className="col-span-2">
                   <span className={`text-xs font-bold px-2 py-0.5 rounded ${kw.difficulty === 'Low' ? 'bg-emerald-500/20 text-emerald-400' : kw.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                     {kw.difficulty}
                   </span>
                 </div>
                 <div className="col-span-3 text-xs text-gray-400 leading-snug">{kw.strategy}</div>
               </div>
             ))}
           </div>
         </div>
      )}
    </div>
  );
}

export default function KeywordHunter() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <KeywordHunterInner />
    </Suspense>
  );
}
