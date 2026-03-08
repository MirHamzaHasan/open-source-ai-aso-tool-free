"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

type LocaleContextType = {
  country: string;
  lang: string;
  modelString: string;
  setCountry: (country: string) => void;
  setLang: (lang: string) => void;
  setModelString: (model: string) => void;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Defaulting to US English
  const [country, setCountry] = useState('us');
  const [lang, setLang] = useState('en');
  const [modelString, setModelString] = useState('google:gemini-2.0-flash');

  return (
    <LocaleContext.Provider value={{ country, lang, modelString, setCountry, setLang, setModelString }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
