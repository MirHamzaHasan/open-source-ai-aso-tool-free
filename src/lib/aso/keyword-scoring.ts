/**
 * Utility to calculate an estimated "Keyword Score" (1-100)
 * 
 * In a real ASO pipeline, this would use proprietary data (Search Volume index from Apple/Google).
 * Since we only have free scraper data, we estimate this based on:
 * 1. The length/specificity of the keyword (Long-tail usually has better conversion but lower volume)
 * 2. The number of competitors (if we scrape search results)
 * 3. Exact match in the top 10 results' titles
 */

export interface KeywordScoreResult {
  keyword: string;
  score: number; // 1-100 overall score
  volumeEstimate: number; // 1-100
  competitionEstimate: number; // 1-100 (Higher = harder to rank)
  insights: string[];
}

export function calculateKeywordScore(
  keyword: string, 
  searchResults: any[] = []
): KeywordScoreResult {
  const insights: string[] = [];
  
  // 1. Estimate Volume based on length/words (Heuristics for free tier)
  // Shorter keywords (1-2 words) generally have much higher volume
  const wordCount = keyword.trim().split(/\s+/).length;
  let volumeEstimate = 50;
  
  if (wordCount === 1) {
    volumeEstimate = 90;
    insights.push("High search volume expected (head term).");
  } else if (wordCount === 2) {
    volumeEstimate = 75;
    insights.push("Medium-high search volume expected.");
  } else if (wordCount === 3) {
    volumeEstimate = 45;
    insights.push("Moderate volume (long-tail), better conversion chance.");
  } else {
    volumeEstimate = 20;
    insights.push("Low volume, highly specific long-tail keyword.");
  }

  // 2. Estimate Competition
  // If we have search results, check how many top apps use this exact keyword in their title
  let competitionEstimate = 50;
  let titleMatches = 0;

  if (searchResults && searchResults.length > 0) {
    const top10 = searchResults.slice(0, 10);
    
    top10.forEach(app => {
      const title = (app.title || '').toLowerCase();
      if (title.includes(keyword.toLowerCase())) {
        titleMatches++;
      }
    });

    if (titleMatches >= 7) {
      competitionEstimate = 95;
      insights.push("Extremely competitive. Top apps heavily target this in titles.");
    } else if (titleMatches >= 4) {
      competitionEstimate = 75;
      insights.push("High competition. Several top apps use this in titles.");
    } else if (titleMatches >= 1) {
      competitionEstimate = 40;
      insights.push("Moderate competition. Opportunity exists.");
    } else {
      competitionEstimate = 15;
      insights.push("Low competition! Top apps do not use this exact phrase in titles.");
    }
  } else {
    // Fallback if no search data provided
    competitionEstimate = wordCount <= 2 ? 80 : 30;
    insights.push("Competition estimated based on keyword length (no search data provided).");
  }

  // 3. Calculate Final Score (1-100)
  // A good keyword has HIGH volume and LOW competition.
  // We weight them: 60% Competition (easier is better), 40% Volume
  const competitionScore = 100 - competitionEstimate; // Invert because low competition is good
  let score = Math.round((volumeEstimate * 0.4) + (competitionScore * 0.6));
  
  // Clamp score
  score = Math.max(1, Math.min(100, score));

  return {
    keyword,
    score,
    volumeEstimate,
    competitionEstimate,
    insights
  };
}
