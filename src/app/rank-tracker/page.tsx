"use client";

import { useState, useEffect, Suspense } from "react";
import { Trophy, Loader2, Sparkles, AlertCircle, Plus, Search, Trash2, Bot, Download } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface RankResult {
  keyword: string;
  rank: number | null; // null means unranked (not in top 50)
  loading: boolean;
  error?: string;
  previousRank?: number | null;
}

function RankTrackerInner() {
  const { lang, country } = useLocale();
  const [appId, setAppId] = useState("");
  const [storeType, setStoreType] = useState<"play" | "ios">("play");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [activeKeywords, setActiveKeywords] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, RankResult>>({});
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isAutoDiscovering, setIsAutoDiscovering] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [errorBorder, setErrorBorder] = useState(false);

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  const initStore = searchParams.get("store");

  useEffect(() => {
    if (initId) setAppId(initId);
    if (initStore === "play" || initStore === "ios") setStoreType(initStore);
  }, [initId, initStore]);

  const addKeywords = () => {
    if (!keywordsInput.trim()) return;
    
    // Split by comma or newline
    const newKeywords = keywordsInput
      .split(/[,\\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0 && !activeKeywords.includes(k));
      
    if (newKeywords.length > 0) {
      setActiveKeywords(prev => [...prev, ...newKeywords]);
      
      // Initialize results state for new keywords
      const newResults = { ...results };
      newKeywords.forEach(kw => {
        newResults[kw] = { keyword: kw, rank: null, loading: false };
      });
      setResults(newResults);
    }
    setKeywordsInput("");
  };

  const removeKeyword = (kwToRemove: string) => {
    setActiveKeywords(prev => prev.filter(kw => kw !== kwToRemove));
    const newResults = { ...results };
    delete newResults[kwToRemove];
    setResults(newResults);
  };

  const autoDiscoverKeywords = async () => {
    if (!appId) {
      setErrorBorder(true);
      setTimeout(() => setErrorBorder(false), 2000);
      return;
    }

    setIsAutoDiscovering(true);
    try {
      // 1. Fetch App Metadata
      const endpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      const appRes = await fetch(`${endpoint}?type=app&appId=${appId}&lang=${lang}&country=${country}`);
      const appData = await appRes.json();
      
      if (!appData.success || !appData.data) {
        throw new Error("Could not fetch app metadata to discover keywords.");
      }
      
      toast.success("App metadata found! Generating keywords...");

      const metadata = {
        title: appData.data.title || "",
        subtitle: storeType === 'play' ? appData.data.summary : appData.data.subtitle || "",
        description: appData.data.description || "",
        storeType
      };

      // 2. Generate long-tail keywords using AI
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'auto-discover-keywords',
          data: metadata,
          model: aiModel,
          provider: aiModel.startsWith('gemini') ? 'google' : aiModel.startsWith('gpt') ? 'openai' : 'anthropic'
        })
      });

      const aiData = await aiRes.json();
      if (!aiData.success || !aiData.data?.keywords) {
        throw new Error("AI failed to generate keywords.");
      }

      const generatedKeywords = aiData.data.keywords;

      // 3. Add to tracking list
      const newKeywords = generatedKeywords.filter((k: string) => !activeKeywords.includes(k));
      if (newKeywords.length > 0) {
        setActiveKeywords(prev => [...prev, ...newKeywords]);
        
        const newResults = { ...results };
        newKeywords.forEach((kw: string) => {
          newResults[kw] = { keyword: kw, rank: null, loading: false };
        });
        setResults(newResults);
      }
      
      // We don't automatically trigger "Check All", letting the user see them first or we could. 
      // User requested "immediately see full diagnostic", so let's trigger check all.
      // Wait a tiny bit for state to settle then check ranks that are fresh
      setTimeout(() => {
        // Trigger check rank for all newly added ones
        newKeywords.forEach((kw: string) => checkRank(kw));
      }, 500);

    } catch (e: any) {
      toast.error(e.message || "Something went wrong during auto-discovery.");
    } finally {
        setIsAutoDiscovering(false);
    }
  };

  const checkRank = async (keyword: string) => {
    if (!appId) {
      setErrorBorder(true);
      setTimeout(() => setErrorBorder(false), 2000);
      return;
    }

    setResults(prev => ({
      ...prev,
      [keyword]: { ...prev[keyword], loading: true, error: undefined }
    }));

    try {
      const endpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      const searchRes = await fetch(`${endpoint}?type=search&term=${encodeURIComponent(keyword)}&lang=${lang}&country=${country}`);
      const searchData = await searchRes.json();
      
      if (!searchData.success) {
        throw new Error(searchData.error || 'Failed to fetch search results');
      }

      const apps = searchData.data || [];
      
      // Find the app's rank (1-indexed)
      let foundRank = null;
      const targetId = appId.trim().toLowerCase();
      
      for (let i = 0; i < apps.length; i++) {
        const resultAppProps = [
          String(apps[i].appId || ""),
          String(apps[i].id || ""),
          String(apps[i].trackId || ""),
          String(apps[i].bundleId || "")
        ].map(id => id.toLowerCase());
        
        if (resultAppProps.includes(targetId)) {
          foundRank = i + 1;
          break;
        }
      }

      setResults(prev => ({
        ...prev,
        [keyword]: {
          keyword,
          previousRank: prev[keyword]?.rank, // Store previous to show movement
          rank: foundRank,
          loading: false
        }
      }));

    } catch (e: any) {
      setResults(prev => ({
        ...prev,
        [keyword]: { ...prev[keyword], loading: false, error: e.message }
      }));
    }
  };

  const checkAllRanks = async () => {
    if (!appId) {
      setErrorBorder(true);
      setTimeout(() => setErrorBorder(false), 2000);
      return;
    }

    setIsCheckingAll(true);
    
    // Batch process in chunks of 5 to avoid completely overwhelming the browser/backend
    const chunkSize = 5;
    for (let i = 0; i < activeKeywords.length; i += chunkSize) {
      const chunk = activeKeywords.slice(i, i + chunkSize);
      await Promise.all(chunk.map(kw => checkRank(kw)));
      if (i + chunkSize < activeKeywords.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Small pause between chunks
      }
    }
    
    setIsCheckingAll(false);
  };

  const exportToCSV = () => {
    if (activeKeywords.length === 0) return;
    
    // Create CSV header
    let csvContent = "Keyword,Current Rank,Previous Rank\\n";
    
    // Add rows
    activeKeywords.forEach(kw => {
      const res = results[kw];
      const rank = res?.rank !== null ? res.rank : "50+";
      const prev = res?.previousRank !== null && res?.previousRank !== undefined ? res.previousRank : "N/A";
      // Escape commas in keyword just in case
      csvContent += `"${kw.replace(/"/g, '""')}",${rank},${prev}\\n`;
    });
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rank-tracker-${appId || 'export'}-${storeType}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rank data exported to CSV!");
  };

  const getRankStyle = (rank: number | null) => {
    if (rank === null) return "text-gray-500 bg-gray-500/10 border-gray-500/20";
    if (rank <= 3) return "text-emerald-400 bg-emerald-500/20 border-emerald-500/40 text-lg font-black";
    if (rank <= 10) return "text-green-400 bg-green-500/10 border-green-500/30 font-bold";
    if (rank <= 30) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          Rank Tracker
        </h1>
        <p className="text-gray-400 text-lg">
          Track your app's search position for specific keywords in the top 50 results. Select your region from the top menu to check localized ranks.
        </p>
      </div>

      <div className={`bg-white/5 border ${errorBorder ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-white/10'} rounded-2xl p-6 backdrop-blur-xl transition-all duration-300`}>
        <div className="flex flex-wrap lg:flex-nowrap gap-4 mb-6">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target App ID</label>
            <input 
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. com.kiloo.subwaysurf or 512939461"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Store</label>
            <select 
              value={storeType}
              onChange={(e) => setStoreType(e.target.value as "play" | "ios")}
              className="bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none w-40 cursor-pointer"
            >
              <option value="play">Google Play</option>
              <option value="ios">App Store</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeywords()}
              placeholder="Add keywords to track (comma separated)"
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button 
            onClick={addKeywords}
            disabled={!keywordsInput.trim() || isAutoDiscovering}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-6 py-3 font-bold flex items-center gap-2 transition-all"
          >
            <Plus className="w-5 h-5" /> Add
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                 <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                 <h3 className="text-sm font-bold text-white">AI Auto-Discover</h3>
                 <p className="text-xs text-gray-400">Instantly find & track long-tail keywords for this app</p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <select 
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="bg-black/40 border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              </select>
              <button 
                onClick={autoDiscoverKeywords}
                disabled={!appId || isAutoDiscovering}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]"
              >
                {isAutoDiscovering ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Discovering...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Auto-Discover & Track</>
                )}
              </button>
           </div>
        </div>
      </div>

      {activeKeywords.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-white/10 bg-black/40 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              Tracked Keywords ({activeKeywords.length})
            </h3>
            <div className="flex gap-3 items-center">
              <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded hidden sm:inline-block">Location: {country.toUpperCase()}</span>
              
              <button 
                onClick={exportToCSV}
                className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-bold flex items-center gap-2 transition-all"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button 
                onClick={checkAllRanks}
                disabled={isCheckingAll || !appId}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all"
              >
                {isCheckingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Check All
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-widest w-[40%]">Keyword</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-widest text-center w-[30%]">Current Rank</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-widest text-right w-[30%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeKeywords.map(kw => {
                  const result = results[kw];
                  const isLoading = result?.loading;
                  const rank = result?.rank;
                  const prevRank = result?.previousRank;
                  const error = result?.error;

                  let movement = null;
                  if (rank !== null && prevRank !== null && prevRank !== undefined) {
                    const diff = prevRank - rank; // Positive diff means rank improved (lower number)
                    if (diff > 0) movement = <span className="text-emerald-400 text-xs flex items-center ml-2">↑ {diff}</span>;
                    else if (diff < 0) movement = <span className="text-rose-400 text-xs flex items-center ml-2">↓ {Math.abs(diff)}</span>;
                    else movement = <span className="text-gray-500 text-xs flex items-center ml-2">-</span>;
                  } else if (prevRank === null && rank !== null) {
                    movement = <span className="text-emerald-400 text-xs flex items-center ml-2">NEW</span>;
                  }

                  return (
                    <tr key={kw} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <span className="text-white font-medium">{kw}</span>
                      </td>
                      <td className="p-4 text-center">
                        {isLoading ? (
                          <div className="flex justify-center"><Loader2 className="w-5 h-5 text-amber-500 animate-spin" /></div>
                        ) : error ? (
                          <div className="flex items-center justify-center gap-1 text-xs text-red-400" title={error}>
                            <AlertCircle className="w-4 h-4" /> Error
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className={`px-3 py-1 rounded-full border flex items-center justify-center min-w-[60px] ${getRankStyle(rank)}`}>
                              {rank === null ? '50+' : `#${rank}`}
                            </span>
                            {movement}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => checkRank(kw)}
                            disabled={isLoading || !appId || isCheckingAll}
                            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh Rank"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => removeKeyword(kw)}
                            disabled={isLoading || isCheckingAll}
                            className="p-2 text-gray-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Remove Keyword"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Additional lucide-react imports needed for the component that were missing in the first import list
import { Target, RefreshCw } from "lucide-react";

export default function RankTracker() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <RankTrackerInner />
    </Suspense>
  );
}
