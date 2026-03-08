"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Star, Search, FolderHeart, PenTool, Sparkles, ShieldAlert, MessageSquare, ArrowRight, Zap, Globe, Target, Trophy } from "lucide-react";
import Link from "next/link";

interface PortfolioApp {
  id: string;
  store: "play" | "ios";
  customAnalysis?: {
    overallScore: number;
    topKeywords?: string[];
    currentKeywords?: string[];
    potential: string;
    suggestions: string[];
  };
}

export default function DashboardOverview() {
  const [trackedApps, setTrackedApps] = useState<PortfolioApp[]>([]);
  const [totalKeywords, setTotalKeywords] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("draco_aso_portfolio");
    if (saved) {
      try {
        const parsed: PortfolioApp[] = JSON.parse(saved);
        setTrackedApps(parsed);
        
        const analyzed = parsed.filter(a => a.customAnalysis);
        const kws = analyzed.reduce((acc, a) => acc + (a.customAnalysis?.topKeywords?.length || 0), 0);
        setTotalKeywords(kws);
        
        if (analyzed.length > 0) {
          const avg = analyzed.reduce((acc, a) => acc + (a.customAnalysis?.overallScore || 0), 0) / analyzed.length;
          setAvgScore(Math.round(avg));
        }
      } catch {} 
    }
  }, []);

  const tools = [
    { name: "Keyword Planner", desc: "Research & discover high-volume keywords for any niche.", href: "/keyword-planner", icon: Search, color: "from-emerald-500 to-green-600", glow: "emerald" },
    { name: "Keyword Hunter", desc: "AI-powered bulk keyword mining from competitors.", href: "/keyword-hunter", icon: Target, color: "from-rose-500 to-pink-600", glow: "rose" },
    { name: "Listing Builder", desc: "Draft, optimize, translate & export ASO metadata.", href: "/listing-builder", icon: PenTool, color: "from-cyan-500 to-blue-600", glow: "cyan" },
    { name: "AI Check", desc: "Get an instant ASO health score and suggestions.", href: "/ai-check", icon: Sparkles, color: "from-indigo-500 to-purple-600", glow: "indigo" },
    { name: "Competitor Watch", desc: "Spy on competitor keyword strategies and reviews.", href: "/competitor-watch", icon: ShieldAlert, color: "from-amber-500 to-orange-600", glow: "amber" },
    { name: "Review Miner", desc: "Analyze user sentiment, feature requests & bugs.", href: "/review-miner", icon: MessageSquare, color: "from-fuchsia-500 to-pink-600", glow: "fuchsia" },
    { name: "Rank Tracker", desc: "Track your keyword positions regionally.", href: "/rank-tracker", icon: Trophy, color: "from-yellow-500 to-amber-600", glow: "yellow" },
    { name: "My Portfolio", desc: "Track your apps, get AI audits & see growth suggestions.", href: "/portfolio", icon: FolderHeart, color: "from-violet-500 to-purple-600", glow: "violet" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-900/40 via-purple-900/30 to-black p-10 backdrop-blur-xl">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-fuchsia-500/15 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-5xl font-extrabold tracking-tight text-white mb-3">
            DracoArts AI Based ASO <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">Command Center</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Your all-in-one App Store Optimization toolkit. Research keywords, spy on competitors, build perfect listings, and track everything with AI-powered insights.
          </p>
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FolderHeart} label="Tracked Apps" value={String(trackedApps.length)} accent="fuchsia" />
        <StatCard icon={BarChart3} label="Avg ASO Score" value={avgScore > 0 ? `${avgScore}/100` : "—"} accent="emerald" />
        <StatCard icon={Search} label="Keywords Tracked" value={String(totalKeywords)} accent="cyan" />
        <StatCard icon={Globe} label="Languages" value="15" accent="indigo" />
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-400" /> Your ASO Toolkit
        </h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.name}
                href={tool.href}
                className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-indigo-500/50 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${tool.color} opacity-5 group-hover:opacity-15 rounded-full blur-[60px] transition-opacity duration-500 pointer-events-none`} />
                <div className="relative z-10 flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.color} shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                      {tool.name}
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Portfolio Quick Glance (if apps are tracked) */}
      {trackedApps.filter(a => a.customAnalysis).length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
           <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-emerald-400" /> Portfolio Insights
             </h2>
             <Link href="/portfolio" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
             </Link>
           </div>
           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
             {trackedApps.filter(a => a.customAnalysis).slice(0, 3).map((app) => (
                <div key={`${app.store}-${app.id}`} className="p-4 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-mono text-gray-400 truncate max-w-[180px]">{app.id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${(app.customAnalysis?.overallScore ?? 0) > 75 ? 'bg-emerald-500/20 text-emerald-400' : (app.customAnalysis?.overallScore ?? 0) > 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                      {app.customAnalysis?.overallScore}/100
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(app.customAnalysis?.currentKeywords || app.customAnalysis?.topKeywords || []).slice(0, 3).map((kw, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-gray-300 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any, label: string, value: string, accent: string }) {
  const colorMap: Record<string, string> = {
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/20 border-fuchsia-500/30",
    emerald: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
    cyan: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
    indigo: "text-indigo-400 bg-indigo-500/20 border-indigo-500/30",
  };
  const colors = colorMap[accent] || colorMap.indigo;
  
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="w-20 h-20 text-gray-500 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 text-gray-400 font-medium mb-3">
          <div className={`p-2 rounded-xl border ${colors}`}>
            <Icon className="w-4 h-4" />
          </div>
          {label}
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">{value}</h2>
      </div>
    </div>
  );
}
