"use client";

import { Bell, Command, Settings, Globe, Bot } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Topbar() {
  const { lang, country, modelString, setLang, setCountry, setModelString } = useLocale();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [customLocalModel, setCustomLocalModel] = useState("");
  
  const isLocalCustom = modelString.startsWith('local:') && modelString !== 'local:generic';

  const handleCustomModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomLocalModel(e.target.value);
  };

  const applyCustomModel = () => {
    if (customLocalModel.trim()) {
      setModelString(`local:${customLocalModel.trim()}`);
    }
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/keyword-planner?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-8 text-white">
      <div className="flex items-center">
        <div className="relative group flex items-center gap-4">
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Command className="h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
             </div>
             <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               onKeyDown={handleSearch}
               className="block w-64 md:w-96 pl-10 pr-3 py-2 border border-white/10 rounded-full leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white/10 transition-all duration-300 sm:text-sm"
               placeholder="Quick search apps or keywords... (⌘K)"
             />
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-sm">
           <Bot className="w-4 h-4 text-emerald-400" />
           <select 
             value={modelString}
             onChange={(e) => setModelString(e.target.value)}
             className="bg-transparent border-none text-gray-300 outline-none cursor-pointer hover:text-white max-w-[140px] truncate"
           >
             <optgroup label="Google (Gemini)">
               <option value="google:gemini-3.1-pro" className="bg-gray-900">Gemini 3.1 Pro 🌟</option>
               <option value="google:gemini-2.5-pro" className="bg-gray-900">Gemini 2.5 Pro 🧠</option>
               <option value="google:gemini-2.5-flash" className="bg-gray-900">Gemini 2.5 Flash ✨</option>
               <option value="google:gemini-2.0-flash" className="bg-gray-900">Gemini 2.0 Flash 🚀</option>
               <option value="google:gemini-2.0-pro-exp-02-05" className="bg-gray-900">Gemini 2.0 Pro (Exp)</option>
               <option value="google:gemini-1.5-pro" className="bg-gray-900">Gemini 1.5 Pro</option>
             </optgroup>
             <optgroup label="OpenAI">
               <option value="openai:gpt-4o" className="bg-gray-900">GPT-4o 🧠</option>
               <option value="openai:gpt-4o-mini" className="bg-gray-900">GPT-4o Mini ⚡</option>
               <option value="openai:gpt-4-turbo" className="bg-gray-900">GPT-4 Turbo 🚀</option>
             </optgroup>
             <optgroup label="Anthropic">
               <option value="anthropic:claude-3-5-sonnet-20240620" className="bg-gray-900">Claude 3.5 Sonnet</option>
               <option value="anthropic:claude-3-opus-20240229" className="bg-gray-900">Claude 3 Opus</option>
               <option value="anthropic:claude-3-haiku-20240307" className="bg-gray-900">Claude 3 Haiku</option>
             </optgroup>
             <optgroup label="DeepSeek">
               <option value="deepseek:deepseek-chat" className="bg-gray-900">DeepSeek V3 💬</option>
               <option value="deepseek:deepseek-reasoner" className="bg-gray-900">DeepSeek R1 🧠</option>
             </optgroup>
             <optgroup label="Local (Ollama)">
               <option value="local:generic" className="bg-gray-900">Generic Ollama 🦙</option>
               {isLocalCustom && <option value={modelString} className="bg-gray-900">{modelString.split(':')[1]} ⚡</option>}
             </optgroup>
           </select>
           {modelString === 'local:generic' && (
              <div className="flex items-center gap-1 ml-2">
                 <input 
                   type="text" 
                   value={customLocalModel}
                   onChange={handleCustomModelChange}
                   onKeyDown={(e) => e.key === 'Enter' && applyCustomModel()}
                   placeholder="e.g. phi3" 
                   className="bg-black/40 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none w-24"
                 />
                 <button onClick={applyCustomModel} className="bg-white/10 hover:bg-white/20 rounded px-2 py-1 text-xs text-white">
                    Set
                 </button>
              </div>
           )}
        </div>

        {/* Global Locale Selector */}
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-sm hidden lg:flex">
           <Globe className="w-4 h-4 text-indigo-400" />
           <select 
             value={lang} 
             onChange={(e) => setLang(e.target.value)}
             className="bg-transparent border-none text-gray-300 outline-none cursor-pointer hover:text-white max-w-[80px]"
           >
             <option value="ar" className="bg-gray-900">AR (Arabic)</option>
             <option value="zh" className="bg-gray-900">ZH (Chinese)</option>
             <option value="en" className="bg-gray-900">EN (English)</option>
             <option value="fr" className="bg-gray-900">FR (French)</option>
             <option value="de" className="bg-gray-900">DE (German)</option>
             <option value="hi" className="bg-gray-900">HI (Hindi)</option>
             <option value="id" className="bg-gray-900">ID (Indonesian)</option>
             <option value="it" className="bg-gray-900">IT (Italian)</option>
             <option value="ja" className="bg-gray-900">JA (Japanese)</option>
             <option value="ko" className="bg-gray-900">KO (Korean)</option>
             <option value="pt" className="bg-gray-900">PT (Portuguese)</option>
             <option value="ru" className="bg-gray-900">RU (Russian)</option>
             <option value="es" className="bg-gray-900">ES (Spanish)</option>
             <option value="tr" className="bg-gray-900">TR (Turkish)</option>
             <option value="vi" className="bg-gray-900">VI (Vietnamese)</option>
           </select>
           <span className="text-gray-600">|</span>
           <select 
             value={country} 
             onChange={(e) => setCountry(e.target.value)}
             className="bg-transparent border-none text-gray-300 outline-none cursor-pointer uppercase hover:text-white max-w-[80px]"
           >
             <option value="ae" className="bg-gray-900">AE (UAE)</option>
             <option value="au" className="bg-gray-900">AU (Australia)</option>
             <option value="br" className="bg-gray-900">BR (Brazil)</option>
             <option value="ca" className="bg-gray-900">CA (Canada)</option>
             <option value="cn" className="bg-gray-900">CN (China)</option>
             <option value="fr" className="bg-gray-900">FR (France)</option>
             <option value="de" className="bg-gray-900">DE (Germany)</option>
             <option value="in" className="bg-gray-900">IN (India)</option>
             <option value="id" className="bg-gray-900">ID (Indonesia)</option>
             <option value="it" className="bg-gray-900">IT (Italy)</option>
             <option value="jp" className="bg-gray-900">JP (Japan)</option>
             <option value="kr" className="bg-gray-900">KR (South Korea)</option>
             <option value="mx" className="bg-gray-900">MX (Mexico)</option>
             <option value="ru" className="bg-gray-900">RU (Russia)</option>
             <option value="tr" className="bg-gray-900">TR (Turkey)</option>
             <option value="uk" className="bg-gray-900">UK (United Kingdom)</option>
             <option value="us" className="bg-gray-900">US (United States)</option>
           </select>
        </div>

      </div>
    </header>
  );
}
