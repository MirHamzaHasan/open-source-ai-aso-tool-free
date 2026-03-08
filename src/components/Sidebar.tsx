"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, MessageSquare, ShieldAlert, Sparkles, PenTool, FolderHeart, Target, Trophy } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "My Portfolio", href: "/portfolio", icon: FolderHeart },
    { name: "Keyword Planner", href: "/keyword-planner", icon: Search },
    { name: "Keyword Hunter", href: "/keyword-hunter", icon: Target },
    { name: "Listing Builder", href: "/listing-builder", icon: PenTool },
    { name: "Review Miner", href: "/review-miner", icon: MessageSquare },
    { name: "Competitor Watch", href: "/competitor-watch", icon: ShieldAlert },
    { name: "Rank Tracker", href: "/rank-tracker", icon: Trophy },
    { name: "AI Check", href: "/ai-check", icon: Sparkles },
  ];

  return (
    <div className="w-64 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-full sticky top-0 transition-all duration-300">
      <div className="p-6 flex items-center space-x-3">
        <Image src="/logo.svg" alt="DracoArts Logo" width={32} height={32} className="rounded-lg shadow-lg shadow-indigo-500/20" />
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 leading-tight">
          DracoArts AI Based ASO
        </span>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "group flex items-center px-3 py-3 rounded-xl transition-all duration-300 relative overflow-hidden",
                isActive 
                  ? "text-white bg-white/10" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
              <Icon 
                className={cn(
                  "mr-3 h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                  isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-indigo-300"
                )} 
              />
              <span className="font-medium tracking-wide text-sm">{link.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 space-y-2">
          <p className="text-xs text-gray-400 leading-relaxed font-medium">
            Created by <span className="font-bold text-gray-300">Mir Hamza Hasan</span>
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-indigo-400">
            <a href="#" onClick={(e) => { e.preventDefault(); window.open(atob('aHR0cHM6Ly9taXJoYW16YWhhc2FuLmNvbQ=='), '_blank'); }} className="hover:text-indigo-300 hover:underline cursor-pointer">Website</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open(atob('aHR0cHM6Ly93YS5tZS85NzE1NjkzMTU5NTM='), '_blank'); }} className="hover:text-indigo-300 hover:underline cursor-pointer">WhatsApp</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.href = atob('bWFpbHRvOm1pcmhhbXphaGFzYW5AZ21haWwuY29t'); }} className="hover:text-indigo-300 hover:underline cursor-pointer">Email</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open(atob('aHR0cHM6Ly90Lm1lL21pcmhhbXphaGFzYW4='), '_blank'); }} className="hover:text-indigo-300 hover:underline cursor-pointer">Telegram</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open(atob('aHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luL21pcmhhbXphaGFzYW4='), '_blank'); }} className="hover:text-indigo-300 hover:underline cursor-pointer">LinkedIn</a>
          </div>
        </div>
      </div>
    </div>
  );
}
