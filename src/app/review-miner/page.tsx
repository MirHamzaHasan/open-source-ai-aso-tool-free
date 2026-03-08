"use client";

import { useState, useEffect, Suspense } from "react";
import { MessageSquare, Star, Filter, Download, Sparkles, Loader2, Bot } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function ReviewMinerInner() {
  const { lang, country, modelString } = useLocale();
  const [appId, setAppId] = useState("");
  const [storeType, setStoreType] = useState("play");
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const initId = searchParams.get("id");
  const initStore = searchParams.get("store");

  useEffect(() => {
    if (initId) setAppId(initId);
    if (initStore === "play" || initStore === "ios") setStoreType(initStore);
  }, [initId, initStore]);

  const fetchReviews = async () => {
    if (!appId) return;
    setLoading(true);
    setAiSummary(null);

    try {
      const endpoint = storeType === 'play' ? '/api/play-store' : '/api/app-store';
      const res = await fetch(`${endpoint}?type=reviews&appId=${appId}&lang=${lang}&country=${country}`);
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || 'Failed to fetch reviews');
      
      // Both APIs now return the array directly in data.data
      const normalized = data.data;
      setReviews(normalized || []);

    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const generateAISummary = async () => {
    if (reviews.length === 0) return;
    setAiLoading(true);

    try {
       // Just send text to save tokens
       const reviewTexts = reviews.slice(0, 30).map(r => r.text || r.content);
       const [provider, model] = modelString.split(':');

       const aiPayload = {
        type: 'reviews',
        provider,
        model,
        data: reviewTexts
      };

      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload)
      });
      
      const aiData = await res.json();
      if (!aiData.success) throw new Error(aiData.error);

      setAiSummary(aiData.data);
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const exportReviewsCSV = () => {
    if (reviews.length === 0) return;
    
    let csvContent = "Date,Rating,Author,Title,Review\\n";
    
    reviews.forEach(review => {
      const date = new Date(review.date || Date.now()).toLocaleDateString();
      const rating = review.score || review.rating || "N/A";
      const author = `"${(review.userName || 'Anonymous').replace(/"/g, '""')}"`;
      const title = `"${(review.title || '').replace(/"/g, '""')}"`;
      const text = `"${(review.text || review.content || '').replace(/"/g, '""')}"`;
      
      csvContent += `${date},${rating},${author},${title},${text}\\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reviews-${appId || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Reviews exported to CSV!");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-pink-500" />
            Review Miner & AI Sentiment
          </h1>
          <p className="text-gray-400 text-lg">
            Scrape reviews and utilize Multi-AI to instantly extract bugs, feature requests, and sentiment.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <input 
          type="text" 
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="App ID (e.g. com.dracoarts.game)"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono text-sm relative z-10 min-w-[200px]"
        />
        <select 
            value={storeType}
            onChange={(e) => setStoreType(e.target.value)}
            className="bg-black/60 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-pink-500 outline-none w-36 font-medium cursor-pointer relative z-10"
          >
            <option value="play">Google Play</option>
            <option value="ios">App Store</option>
        </select>
        <button 
          onClick={fetchReviews}
          disabled={loading || !appId}
          className="bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(219,39,119,0.3)] transition-transform hover:scale-105 active:scale-95 relative z-10 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
          Fetch Reviews
        </button>
        {reviews.length > 0 && (
          <button 
            onClick={exportReviewsCSV}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl transition-all relative z-10 flex items-center gap-2"
            title="Export to CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* AI Summary Section */}
      {reviews.length > 0 && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-black p-6 backdrop-blur-md relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" />
              AI Review Analysis
            </h3>
            
            {!aiSummary ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={generateAISummary}
                  disabled={aiLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Insights
                </button>
              </div>
            ) : (
                <span className="text-xs text-indigo-400 font-bold px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                  Analysis Complete
                </span>
            )}
          </div>

          {aiSummary ? (
            <div className="grid lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
              <div className="col-span-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-gray-300 italic">"{aiSummary.sentimentSummary}"</p>
              </div>
              
              <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <h4 className="font-bold text-blue-400 mb-3 uppercase tracking-wider text-xs">Top Feature Requests</h4>
                <ul className="space-y-2">
                  {aiSummary.featureRequests.map((fr: string, i: number) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-blue-500">•</span> {fr}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <h4 className="font-bold text-rose-400 mb-3 uppercase tracking-wider text-xs">Top Bug Reports</h4>
                <ul className="space-y-2">
                  {aiSummary.bugReports.map((bug: string, i: number) => (
                    <li key={i} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-rose-500">•</span> {bug}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              Click 'Generate Insights' to feed the latest 30 reviews to the AI model.
            </div>
          )}
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-lg">Recent Scraped Reviews ({reviews.length})</h3>
            <span className="text-xs text-gray-500">From {storeType === 'play' ? 'Google Play' : 'App Store'}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reviews.slice(0, 15).map((review, i) => (
              <div key={review.id || i} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors backdrop-blur-md">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center text-yellow-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`w-3.5 h-3.5 ${star <= review.score ? 'fill-current' : 'text-gray-600'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs font-medium">{new Date(review.date || Date.now()).toLocaleDateString()}</span>
                </div>
                <h4 className="text-white font-bold text-sm mb-2">{review.title || 'Review'}</h4>
                <p className="text-gray-400 text-sm line-clamp-4">
                  {review.text || review.content}
                </p>
                <div className="mt-4 text-xs text-gray-600 font-medium">
                  By {review.userName || 'Anonymous'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewMiner() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <ReviewMinerInner />
    </Suspense>
  );
}
