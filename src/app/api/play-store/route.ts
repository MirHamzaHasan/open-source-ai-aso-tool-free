import { NextResponse } from 'next/server';
import gplay from 'google-play-scraper';
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 100, // Maximum number of items
  ttl: 1000 * 60 * 60, // 1 hour time to live
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'app', 'search', 'suggest', 'reviews'
  const term = searchParams.get('term');
  const appId = searchParams.get('appId');
  
  const lang = searchParams.get('lang') || 'en';
  const country = searchParams.get('country') || 'us';

  const cacheKey = `play-${type}-${term || ''}-${appId || ''}-${lang}-${country}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    return NextResponse.json({ success: true, data: cachedData, cached: true });
  }

  try {
    if (type === 'suggest' && term) {
      const results = await gplay.suggest({ term, lang, country });
      cache.set(cacheKey, results);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === 'search' && term) {
      const results = await gplay.search({ term, num: 50, lang, country });
      cache.set(cacheKey, results);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === 'app' && appId) {
      const results = await gplay.app({ appId, lang, country });
      cache.set(cacheKey, results);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === 'similar' && appId) {
      const results = await gplay.similar({ appId, lang, country });
      cache.set(cacheKey, results);
      return NextResponse.json({ success: true, data: results });
    }

    if (type === 'reviews' && appId) {
      const results = await gplay.reviews({ 
        appId, 
        num: 50,
        lang,
        country
      });
      cache.set(cacheKey, results.data);
      return NextResponse.json({ success: true, data: results.data });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type or missing required parameters (term/appId).' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Play Store Scraper Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch from Play Store' },
      { status: 500 }
    );
  }
}
