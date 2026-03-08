"use client";

import { useState, useEffect, Suspense } from "react";
import { PenTool, Save, CheckCircle2, AlertCircle, Copy, Sparkles, Loader2, Bot } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function ListingBuilderInner() {
  const { lang, country, modelString } = useLocale();
  const [storeType, setStoreType] = useState<"play" | "ios">("play");
  const [targetKeywords, setTargetKeywords] = useState("");
  
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState(""); // Also acts as Short Desc for Play
  const [description, setDescription] = useState("");

  const [optimizeAppId, setOptimizeAppId] = useState("");
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [aiMode, setAiMode] = useState<"optimize" | "generate">("optimize");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  const initStore = searchParams.get("store");

  useEffect(() => {
    if (initId) setOptimizeAppId(initId);
    if (initStore === "play" || initStore === "ios") setStoreType(initStore);
  }, [initId, initStore]);

  const limits = {
    play: { title: 30, subtitle: 80, description: 4000 },
    ios: { title: 30, subtitle: 30, description: 4000 }
  };

  const currentLimits = limits[storeType];

  // Helper to parse comma-separated keywords and filter empties
  const getKeywordsList = () => {
    return targetKeywords.split(',').map(kw => kw.trim().toLowerCase()).filter(Boolean);
  };

  // Check if a specific keyword is used in the text fields
  const checkKeywordUsage = (kw: string) => {
    const fullText = `${title} ${subtitle} ${description}`.toLowerCase();
    return fullText.includes(kw);
  };

  const handleOptimize = async () => {
    if (!optimizeAppId.trim()) return;
    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const localeQuery = `&lang=${lang}&country=${country}`;
      const storeEndpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      
      // 1. Fetch App Metadata
      const appRes = await fetch(`${storeEndpoint}?type=app&appId=${optimizeAppId}${localeQuery}`);
      const appData = await appRes.json();
      
      if (!appData.success) throw new Error(appData.error || 'Failed to fetch app details');

      const appDetails = appData.data;
      const metadataToOptimize = {
        title: appDetails.title || '',
        subtitle: storeType === 'play' ? appDetails.summary || '' : appDetails.subtitle || '',
        description: appDetails.description || ''
      };

      // 2. Send to AI
      const [provider, model] = modelString.split(':');
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'optimize-listing',
          provider,
          model,
          data: metadataToOptimize
        })
      });

      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error || 'AI Optimization failed');

      const result = aiData.data;
      
      if (result.suggestedKeywords) {
        setTargetKeywords(prev => prev ? prev + ', ' + result.suggestedKeywords : result.suggestedKeywords);
      }
      if (result.suggestedTitle) setTitle(result.suggestedTitle);
      if (result.suggestedSubtitle) setSubtitle(result.suggestedSubtitle);
      if (result.suggestedDescription) setDescription(result.suggestedDescription);

    } catch (err: any) {
      toast.error(err.message || 'Optimization failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;
    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const [provider, model] = modelString.split(':');
      
      // Attempt to gather context from target keywords
      let trendsContext = '';
      let suggestContext = '';
      
      if (targetKeywords.trim()) {
        const topKeywords = targetKeywords.split(',').map(k => k.trim()).filter(k => k).slice(0, 3);
        
        try {
           const trendPromises = topKeywords.map(kw => fetch(`/api/google-trends?keyword=${encodeURIComponent(kw)}&geo=${country.toUpperCase()}`).then(r => r.json()));
           const trendResults = await Promise.all([...trendPromises]);
           trendsContext = trendResults
             .filter(r => r.success && r.data)
             .map((r, i) => `${topKeywords[i]} (Trend: ${r.data.trendDirection}, Interest: ${r.data.currentInterest}/100)`)
             .join(' | ');
        } catch (e) {
           console.log("Failed to fetch trends for listing generation", e);
        }

        try {
           const storeEndpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
           const suggestPromises = topKeywords.map(kw => fetch(`${storeEndpoint}?type=suggest&appId=${encodeURIComponent(kw)}&lang=${lang}&country=${country}`).then(r => r.json()));
           const suggestResults = await Promise.all([...suggestPromises]);
           const allSuggestions = new Set<string>();
           suggestResults.forEach(r => {
             if (r.success && Array.isArray(r.data)) {
                r.data.forEach((s: string) => allSuggestions.add(s));
             }
           });
           suggestContext = Array.from(allSuggestions).slice(0, 15).join(', ');
        } catch (e) {
           console.log("Failed to fetch suggestions for listing generation", e);
        }
      }

      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generate-listing',
          provider,
          model,
          data: { 
             prompt: generatePrompt, 
             storeType, 
             targetKeywords,
             trendsContext,
             suggestContext
          }
        })
      });

      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error || 'AI Generation failed');

      const result = aiData.data;
      
      if (result.suggestedKeywords) setTargetKeywords(result.suggestedKeywords);
      if (result.suggestedTitle) setTitle(result.suggestedTitle);
      if (result.suggestedSubtitle) setSubtitle(result.suggestedSubtitle);
      if (result.suggestedDescription) setDescription(result.suggestedDescription);

    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleTranslate = async () => {
    if (!title && !subtitle && !description) return;
    setIsTranslating(true);
    setOptimizeError(null);

    try {
      const [provider, model] = modelString.split(':');
      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'translate-listing',
          provider,
          model,
          data: { 
            title, 
            subtitle, 
            description,
            targetLanguage: `${lang} (${country})`
          }
        })
      });

      const aiData = await aiRes.json();
      if (!aiData.success) throw new Error(aiData.error || 'AI Translation failed');

      const result = aiData.data;
      
      if (result.translatedTitle) setTitle(result.translatedTitle);
      if (result.translatedSubtitle) setSubtitle(result.translatedSubtitle);
      if (result.translatedDescription) setDescription(result.translatedDescription);

    } catch (err: any) {
      toast.error(err.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  // Component for displaying character counts with warnings
  const CharCount = ({ current, max }: { current: number, max: number }) => {
    const isOver = current > max;
    const isNear = current >= max * 0.9 && !isOver;
    return (
      <div className={`text-xs font-mono font-medium flex items-center gap-1 ${isOver ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-gray-500'}`}>
        {isOver && <AlertCircle className="w-3 h-3" />}
        {current} / {max}
      </div>
    );
  };

  const handleCopy = () => {
     let text = `--- ${storeType === 'play' ? 'Google Play' : 'App Store'} Metadata ---\n\n`;
     text += `Title:\n${title}\n\n`;
     text += `${storeType === 'play' ? 'Short Description' : 'Subtitle'}:\n${subtitle}\n\n`;
     text += `Description:\n${description}`;
     navigator.clipboard.writeText(text);
     toast.success("Metadata copied to clipboard!");
  };

  const copyField = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${fieldName} copied to clipboard!`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
            <PenTool className="w-8 h-8 text-emerald-400" />
            Listing Builder & Optimizer
          </h1>
          <p className="text-gray-400 text-lg">
            Draft your metadata in real-time. Ensure strict character limits and perfect keyword density.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-8">
        
        {/* Editor Configuration and target keywords */}
        <div className="xl:col-span-1 space-y-6">
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
             <h3 className="font-bold text-white mb-4">Store Format</h3>
             <div className="flex gap-2 bg-black/40 p-1 rounded-xl w-full">
                <button 
                  onClick={() => setStoreType("play")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${storeType === "play" ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  Google Play
                </button>
                <button 
                  onClick={() => setStoreType("ios")}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${storeType === "ios" ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                  App Store
                </button>
             </div>
           </div>

           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">
                   <Sparkles className="w-4 h-4 text-emerald-400" />
                   Target Keywords
                </h3>
             </div>
             <p className="text-xs text-gray-500 mb-4">Paste the keywords you discovered, separated by commas.</p>
             <textarea 
               value={targetKeywords}
               onChange={(e) => setTargetKeywords(e.target.value)}
               placeholder="e.g. racing game, fast cars, multiplayer drift"
               className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder:text-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] text-sm resize-y"
             />

             {/* Keyword Density Checker */}
             <div className="mt-4 space-y-2">
               {getKeywordsList().map((kw, i) => {
                  const used = checkKeywordUsage(kw);
                  return (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-sm border ${used ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-black/40 border-white/5 text-gray-400'}`}>
                      <span>{kw}</span>
                      {used ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-xs px-2 py-0.5 rounded bg-white/5">Missing</span>}
                    </div>
                  )
               })}
             </div>
           </div>

           {/* AI Panel */}
           <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mt-6">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                   <Bot className="w-5 h-5 text-indigo-400" />
                   AI Copilot
                </h3>
             </div>

             <div className="flex gap-2 bg-black/40 p-1 rounded-xl w-full mb-4">
               <button 
                 onClick={() => setAiMode("optimize")}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${aiMode === "optimize" ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 Optimize Existing
               </button>
               <button 
                 onClick={() => setAiMode("generate")}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${aiMode === "generate" ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
               >
                 Write from Scratch
               </button>
             </div>

             <div className="space-y-4">
               {aiMode === 'optimize' ? (
                 <>
                   <p className="text-xs text-gray-400">Enter your current App ID. The AI will analyze your existing metadata, generate new keywords, and draft a better Title and Subtitle.</p>
                   <div>
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">App ID / Package Name</label>
                     <input 
                       type="text"
                       value={optimizeAppId}
                       onChange={(e) => setOptimizeAppId(e.target.value)}
                       placeholder={storeType === 'play' ? "com.example.app" : "123456789"}
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                     />
                   </div>
                 </>
               ) : (
                 <>
                   <p className="text-xs text-gray-400">Describe your new game or app idea. The AI will write the perfect optimized Title, Subtitle, Description, and Keywords for you.</p>
                   <div>
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">App Concept</label>
                     <textarea 
                       value={generatePrompt}
                       onChange={(e) => setGeneratePrompt(e.target.value)}
                       placeholder="e.g. A 3D multiplayer racing game with neon cars and drift mechanics..."
                       className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-indigo-500 text-sm min-h-[80px]"
                     />
                   </div>
                 </>
               )}

               {optimizeError && (
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs shadow-inner">
                   {optimizeError}
                 </div>
               )}

               <button 
                 onClick={aiMode === 'optimize' ? handleOptimize : handleGenerate}
                 disabled={isOptimizing || (aiMode === 'optimize' ? !optimizeAppId : !generatePrompt)}
                 className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all text-sm"
               >
                 {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                 {isOptimizing ? 'Thinking...' : (aiMode === 'optimize' ? 'Auto-Optimize Listing' : 'Generate Full Metadata')}
               </button>
             </div>
           </div>
        </div>

        {/* Real-time Editor */}
        <div className="xl:col-span-2 space-y-6">
           <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-black border border-indigo-500/20 backdrop-blur-md relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />
             
             <div className="flex items-center justify-between mb-8 relative z-10">
               <h2 className="text-2xl font-bold text-white">Metadata Editor</h2>
               <div className="flex items-center gap-3">
                 <button 
                   onClick={handleTranslate} 
                   disabled={isTranslating || (!title && !subtitle && !description)}
                   className="text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                 >
                    {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    Translate to {lang.toUpperCase()}
                 </button>
                 <button onClick={handleCopy} className="text-sm font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Copy className="w-4 h-4" /> Export All
                 </button>
               </div>
             </div>

             <div className="space-y-6 relative z-10">
                {/* TITLE */}
                 <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-300">App Title</label>
                      <div className="flex items-center gap-4">
                        <CharCount current={title.length} max={currentLimits.title} />
                        <button onClick={() => copyField(title, 'Title')} className="text-gray-500 hover:text-white transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                   <input 
                     type="text"
                     value={title}
                     onChange={(e) => setTitle(e.target.value)}
                     className={`w-full bg-black/60 border ${title.length > currentLimits.title ? 'border-red-500/50 focus:ring-red-500' : 'border-white/10 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-white outline-none focus:ring-2 transition-all text-lg font-medium`}
                     placeholder="Your highly optimized app name"
                   />
                </div>

                {/* SUBTITLE / SHORT DESC */}
                 <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-300">
                         {storeType === 'play' ? 'Short Description' : 'Subtitle'}
                      </label>
                      <div className="flex items-center gap-4">
                        <CharCount current={subtitle.length} max={currentLimits.subtitle} />
                        <button onClick={() => copyField(subtitle, 'Subtitle')} className="text-gray-500 hover:text-white transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                   <input 
                     type="text"
                     value={subtitle}
                     onChange={(e) => setSubtitle(e.target.value)}
                     className={`w-full bg-black/60 border ${subtitle.length > currentLimits.subtitle ? 'border-red-500/50 focus:ring-red-500' : 'border-white/10 focus:ring-indigo-500'} rounded-xl px-4 py-3 text-white outline-none focus:ring-2 transition-all`}
                     placeholder={storeType === 'play' ? "A quick hook to get users to read more..." : "A concise summary of your app..."}
                   />
                </div>

                {/* LONG DESC */}
                 <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-300">Full Description</label>
                      <div className="flex items-center gap-4">
                        <CharCount current={description.length} max={currentLimits.description} />
                        <button onClick={() => copyField(description, 'Description')} className="text-gray-500 hover:text-white transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                   <textarea 
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     className={`w-full bg-black/60 border ${description.length > currentLimits.description ? 'border-red-500/50 focus:ring-red-500' : 'border-white/10 focus:ring-indigo-500'} rounded-xl px-4 py-4 text-white outline-none focus:ring-2 transition-all min-h-[300px] resize-y leading-relaxed`}
                     placeholder="Detail your features, benefits, and call to actions here..."
                   />
                </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}

export default function ListingBuilder() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <ListingBuilderInner />
    </Suspense>
  );
}
