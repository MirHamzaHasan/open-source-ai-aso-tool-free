import { NextResponse } from 'next/server';
import store from 'app-store-scraper';
import { calculateKeywordScore } from '@/lib/aso/keyword-scoring';
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
  
  // Note: app-store-scraper country codes are uppercase (e.g. 'US', 'GB') in some cases or lowercase, but standard ISO works mostly, let's keep lowercase as passed
  const lang = searchParams.get('lang') || 'en';
  const country = searchParams.get('country') || 'us';

  const cacheKey = `ios-${type}-${term || ''}-${appId || ''}-${lang}-${country}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return NextResponse.json(cachedData); 
    // using the whole object as we might cache the score along with data
  }

  try {
    if (type === 'suggest' && term) {
      // NOTE: app-store-scraper does not natively expose suggest locale as cleanly, but we try passing it
      const results = await store.suggest({ term });
      const formatted = results.map((r: any) => r.term);
      const responsePayload = { success: true, data: formatted };
      cache.set(cacheKey, responsePayload);
      return NextResponse.json(responsePayload);
    }

    if (type === 'search' && term) {
      const results = await store.search({ term, num: 50, lang, country });
      const score = calculateKeywordScore(term, results);
      const responsePayload = { success: true, data: results, score };
      cache.set(cacheKey, responsePayload);
      return NextResponse.json(responsePayload);
    }

    if (type === 'app' && appId) {
      const results = await store.app({ id: appId, lang, country });
      const responsePayload = { success: true, data: results };
      cache.set(cacheKey, responsePayload);
      return NextResponse.json(responsePayload);
    }

    if (type === 'similar' && appId) {
      const results = await store.similar({ id: appId, lang, country });
      const responsePayload = { success: true, data: results };
      cache.set(cacheKey, responsePayload);
      return NextResponse.json(responsePayload);
    }

    if (type === 'reviews' && appId) {
      const results = await store.reviews({ 
        id: appId, 
        sort: store.sort.RECENT,
        page: 1,
        country // Reviews in App Store are highly localized by country
      });
      return NextResponse.json({ success: true, data: results });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type or missing parameters (term/appId).' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('App Store Scraper Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch from App Store' },
      { status: 500 }
    );
  }
}
