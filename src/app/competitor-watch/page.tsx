"use client";

import { useState, useEffect, Suspense } from "react";
import { ShieldAlert, RefreshCw, BarChart2, Loader2, Play, Sparkles, Download } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function CompetitorWatchInner() {
  const { lang, country, modelString } = useLocale();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [myApp, setMyApp] = useState<any | null>(null);
  const [loadingAppId, setLoadingAppId] = useState<string | null>(null);
  const [myAppId, setMyAppId] = useState("");
  const [extractedKeywords, setExtractedKeywords] = useState<{word: string, count: number}[]>([]);

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  // Competitor Watch doesn't currently easily toggle storeType in UI, but we'll accept it for future.
  
  useEffect(() => {
    if (initId) setMyAppId(initId);
  }, [initId]);

  const fetchAppAndCompetitors = async (appId: string) => {
    if (!appId) return;
    setLoadingAppId(appId);
    setMyApp(null);
    setCompetitors([]);
    setExtractedKeywords([]);

    try {
       const localeQuery = `&lang=${lang}&country=${country}`;
       // 1. Fetch Main App Details
       const appRes = await fetch(`/api/play-store?type=app&appId=${appId}${localeQuery}`);
       const appData = await appRes.json();
       
       if (!appData.success) throw new Error(appData.error);
       setMyApp(appData.data);

       // 2. Automatically discover competitors (Similar Apps)
       const similarRes = await fetch(`/api/play-store?type=similar&appId=${appId}${localeQuery}`);
       const similarData = await similarRes.json();

       if (similarData.success && similarData.data && similarData.data.length > 0) {
          // Filter out apps by the same developer
          const myDevId = appData.data.developerId || appData.data.developer;
          const genuineCompetitors = similarData.data.filter((a: any) => 
            (a.developerId || a.developer) !== myDevId
          );

          // Take top 3 genuine competitors
          const top3Urls = genuineCompetitors.slice(0, 3).map((a: any) => a.appId);
          
          // 3. Fetch full details for the top 3 competitors in parallel
          const compPromises = top3Urls.map((cId: string) => 
            fetch(`/api/play-store?type=app&appId=${cId}${localeQuery}`).then(res => res.json())
          );
          
          const compsResponses = await Promise.all(compPromises);
          const validComps = compsResponses
            .filter(r => r.success && r.data)
            .map(r => r.data);

          setCompetitors(validComps);
          
          // 4. Extract keywords automatically via AI
          extractKeywordsFromComps(validComps);
       }
       
       setMyAppId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-discover competitors. Are you sure the App ID is correct?");
    } finally {
      setLoadingAppId(null);
    }
  };

  const extractKeywordsFromComps = async (comps: any[]) => {
    try {
      const textBlob = comps.map(c => `Title: ${c.title}\nSummary: ${c.summary}`).join("\n\n");
      const [provider, model] = modelString.split(':');
      
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'competitor-keywords',
          provider,
          model,
          data: { competitorText: textBlob }
        })
      });

      const aiData = await aiRes.json();
      if (aiData.success && aiData.data?.keywords) {
        setExtractedKeywords(aiData.data.keywords);
      }
    } catch (e: any) {
      toast.error("AI Keyword Extraction failed: " + e.message);
    }
  };

  const exportToCSV = () => {
    const allApps = myApp ? [myApp, ...competitors] : competitors;
    if (allApps.length === 0) return;

    let csvContent = "Metric," + allApps.map(a => `"${a.title.replace(/"/g, '""')}"`).join(',') + "\\n";
    
    // Rows
    csvContent += "Developer," + allApps.map(a => `"${(a.developer || '').replace(/"/g, '""')}"`).join(',') + "\\n";
    csvContent += "Summary Focus," + allApps.map(a => `"${(a.summary || '').replace(/"/g, '""')}"`).join(',') + "\\n";
    csvContent += "Rating," + allApps.map(a => `"${a.scoreText} (${a.ratings})"`).join(',') + "\\n";
    csvContent += "Installs," + allApps.map(a => `"${a.installs}"`).join(',') + "\\n";
    csvContent += "Genre," + allApps.map(a => `"${a.genre}"`).join(',') + "\\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `competitor-matrix-${myAppId || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Competitor matrix exported to CSV!");
  };

  const colors = ["bg-rose-500", "bg-amber-500", "bg-cyan-500"];
  const allApps = myApp ? [myApp, ...competitors] : competitors;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            Auto Competitor Watch
          </h1>
          <p className="text-gray-400 text-lg">
            Enter your App ID. We'll automatically identify your top competitors and extract keyword opportunities.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
         <div className="flex bg-gradient-to-r from-rose-500/20 to-black border border-rose-500/30 rounded-xl p-2 backdrop-blur-md items-center w-full max-w-xl">
           <input 
             type="text"
             value={myAppId}
             onChange={(e) => setMyAppId(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && fetchAppAndCompetitors(myAppId)}
             placeholder="Enter Main App ID (e.g., com.miniclip.eightballpool)"
             className="bg-transparent border-none px-4 py-2 text-white outline-none placeholder:text-gray-400 text-sm flex-1 font-mono"
           />
           <button  
             onClick={() => fetchAppAndCompetitors(myAppId)}
             disabled={loadingAppId !== null || !myAppId}
             className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg px-6 py-3 text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all"
           >
             {loadingAppId !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
             Auto Discover
           </button>
         </div>
      </div>

      {/* Auto Keyword Analysis */}
      {extractedKeywords.length > 0 && (
         <div className="p-6 rounded-2xl bg-white/5 border border-indigo-500/30 backdrop-blur-md animate-in slide-in-from-top-4 duration-500">
             <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-indigo-400" />
                 Auto-Extracted Competitor Keywords
             </h3>
             <p className="text-sm text-gray-400 mb-4">These terms frequently appear in your top competitors' titles and subtitles.</p>
             <div className="flex flex-wrap gap-2">
                 {extractedKeywords.map((kw, i) => (
                     <div key={i} className="px-4 py-2 rounded-full bg-black/40 border border-white/10 flex items-center gap-2 text-sm text-gray-200">
                         <span className="font-semibold text-indigo-400">{kw.word}</span>
                         <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{kw.count}x</span>
                     </div>
                 ))}
             </div>
         </div>
      )}

      {/* Comparison Table */}
      {allApps.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-500" /> Competitor Matrix
            </h3>
            <button
               onClick={exportToCSV}
               className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto backdrop-blur-md">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-black/40 border-b border-white/10">
                  <th className="p-4 text-gray-400 font-semibold w-[20%]">App Name</th>
                  {myApp && (
                    <th className="p-4 border-l border-white/10 w-[20%]">
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider block">My App</span>
                        <div className="flex items-center gap-3">
                          <img src={myApp.icon} alt="My App Icon" className="w-10 h-10 rounded-xl" referrerPolicy="no-referrer" />
                          <span className="text-white font-bold line-clamp-2">{myApp.title}</span>
                        </div>
                      </div>
                    </th>
                  )}
                  {competitors.map((comp, i) => (
                    <th key={comp.appId} className="p-4 border-l border-white/10 w-[20%]">
                      <div className="flex flex-col gap-2">
                         <span className={`text-xs ${colors[i].replace('bg-', 'text-')} font-bold uppercase tracking-wider block`}>Competitor {i+1}</span>
                        <div className="flex items-center gap-3">
                          <img src={comp.icon} alt="Competitor Icon" className="w-10 h-10 rounded-xl" referrerPolicy="no-referrer" />
                          <span className="text-white font-bold line-clamp-2">{comp.title}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-400 font-medium">Developer</td>
                  {myApp && <td className="p-4 border-l border-white/10 text-white text-sm">{myApp.developer}</td>}
                  {competitors.map(c => <td key={c.appId} className="p-4 border-l border-white/10 text-gray-300 text-sm">{c.developer}</td>)}
                </tr>
                <tr className="hover:bg-white/5 transition-colors bg-white/[0.02]">
                  <td className="p-4 text-gray-400 font-medium">Summary Focus</td>
                  {myApp && <td className="p-4 border-l border-white/10 text-gray-300 text-xs leading-relaxed font-medium">{myApp.summary}</td>}
                  {competitors.map(c => <td key={c.appId} className="p-4 border-l border-white/10 text-gray-300 text-xs leading-relaxed font-medium">{c.summary}</td>)}
                </tr>
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-400 font-medium">Rating / Score</td>
                  {myApp && <td className="p-4 border-l border-white/10 text-white font-bold">{myApp.scoreText} <span className="text-xs text-gray-500 font-normal">({myApp.ratings})</span></td>}
                  {competitors.map(c => <td key={c.appId} className="p-4 border-l border-white/10 text-white font-bold">{c.scoreText} <span className="text-xs text-gray-500 font-normal">({c.ratings})</span></td>)}
                </tr>
                <tr className="hover:bg-white/5 transition-colors bg-white/[0.02]">
                  <td className="p-4 text-gray-400 font-medium">Installs</td>
                  {myApp && <td className="p-4 border-l border-white/10 text-emerald-400 font-mono font-bold">{myApp.installs}</td>}
                  {competitors.map(c => <td key={c.appId} className="p-4 border-l border-white/10 text-emerald-400 font-mono font-bold">{c.installs}</td>)}
                </tr>
                 <tr className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-400 font-medium">Category Rank/Genre</td>
                  {myApp && <td className="p-4 border-l border-white/10 text-indigo-400 text-sm font-semibold">{myApp.genre}</td>}
                  {competitors.map((c, i) => {
                     const colorClass = colors[i].replace('bg-', 'text-');
                     return <td key={c.appId} className={`p-4 border-l border-white/10 ${colorClass} text-sm font-semibold`}>{c.genre}</td>
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/20 text-gray-500 animate-pulse">
           <Play className="w-12 h-12 text-gray-700 mb-4" />
           <p>Enter your Google Play app ID to auto-discover competitors and extract keywords.</p>
        </div>
      )}
    </div>
  );
}

export default function CompetitorWatch() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <CompetitorWatchInner />
    </Suspense>
  );
}
