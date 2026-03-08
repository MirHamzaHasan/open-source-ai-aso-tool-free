import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data, provider = 'google', model } = body;

    let responseData: any = {};
    const prompt = buildPrompt(type, data);

    if (provider === 'google') {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
          model: model || 'gemini-2.0-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
      });
      responseData = JSON.parse(response.text || "{}");
      
    } else if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
      const openai = new OpenAI();
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: model || "gpt-3.5-turbo",
        response_format: { type: "json_object" },
      });
      responseData = JSON.parse(completion.choices[0].message.content || "{}");
      
    } else if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
      const anthropic = new Anthropic();
      const msg = await anthropic.messages.create({
        model: model || "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      });
      // Anthropic does not enforce JSON mode natively in the same way, we extract from text block
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
      responseData = JSON.parse(text);

    } else if (provider === 'deepseek') {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekKey) throw new Error("DEEPSEEK_API_KEY is not set.");
      const deepseekApi = new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' });
      const completion = await deepseekApi.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: model || "deepseek-chat",
        response_format: { type: "json_object" },
      });
      responseData = JSON.parse(completion.choices[0].message.content || "{}");

    } else if (provider === 'local') {
      // Example for Ollama running locally
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
      const actualModel = (model === 'generic' || !model) ? 'llama3' : model;
      const res = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModel, // Use the user-selected model
          prompt: prompt,
          stream: false,
          format: 'json'
        })
      });
      if (!res.ok) throw new Error("Local LLM failed to respond. Ensure Ollama is running and the model '" + actualModel + "' is pulled.");
      const json = await res.json();
      responseData = JSON.parse(json.response || "{}");
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    return NextResponse.json({ success: true, data: responseData });

  } catch (error: any) {
    console.error(`AI Analysis Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate AI analysis' },
      { status: 500 }
    );
  }
}

// Helper to construct prompts
function buildPrompt(type: string, data: any): string {
  if (type === 'metadata') {
    return `
      You are an elite App Store Optimization (ASO) consultant performing a deep-dive analysis.
      Analyze every aspect of the following app listing.

      === APP LISTING ===
      Title: ${data.title}
      Subtitle / Short Description: ${data.subtitle}
      Description: ${data.description.substring(0, 1500)}...
      Store Rating: ${data.rating || 'N/A'}
      Reviews Count: ${data.reviewCount || 'N/A'}
      Installs: ${data.installs || 'N/A'}
      Recent Update Notes: ${data.recentChanges || 'N/A'}

      === COMPETITOR TITLES ===
      ${data.competitorTitles || 'Not available'}

      === RECENT REVIEWS ===
      ${data.reviewSnippets || 'Not available'}

      === GOOGLE TRENDS DATA ===
      ${data.trendsInfo || 'Not available'}

      === REDDIT COMMUNITY BUZZ ===
      ${data.redditInfo || 'Not available'}

      Analyze meticulously and return a JSON report with:
      - 8 scored parameters (1-100 each)
      - Top 5 pros and top 5 cons of the listing
      - Current indexed keywords and suggested new ones
      - How to rank higher (specific, actionable strategies)
      - Competitor observations
      - Community sentiment summary

      Respond ONLY with a valid JSON object matching this EXACT structure:
      {
         "score": 72,
         "scoreBreakdown": {
            "titleScore": { "score": 80, "comment": "explanation" },
            "subtitleScore": { "score": 65, "comment": "explanation" },
            "descriptionScore": { "score": 70, "comment": "explanation" },
            "keywordScore": { "score": 60, "comment": "explanation" },
            "competitiveScore": { "score": 75, "comment": "explanation" },
            "reviewScore": { "score": 85, "comment": "explanation" },
            "trendScore": { "score": 70, "comment": "explanation" },
            "communityScore": { "score": 60, "comment": "explanation" }
         },
         "strengths": ["pro 1", "pro 2", "pro 3", "pro 4", "pro 5"],
         "weaknesses": ["con 1", "con 2", "con 3", "con 4", "con 5"],
         "currentKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
         "suggestedKeywords": ["new1", "new2", "new3", "new4", "new5"],
         "rankingStrategies": [
            { "title": "short title", "detail": "2-sentence actionable step" },
            { "title": "short title", "detail": "2-sentence actionable step" },
            { "title": "short title", "detail": "2-sentence actionable step" },
            { "title": "short title", "detail": "2-sentence actionable step" }
         ],
         "competitorInsights": "2-sentence summary of competitive landscape",
         "communitySentiment": "1-sentence summary of online buzz",
         "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
      }
    `;
  }
  if (type === 'reviews') {
    return `
      You are an expert App Store Optimization analyst.
      Analyze the following batch of user reviews:
      ${JSON.stringify(data).substring(0, 3000)}...
      
      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "sentimentSummary": "string",
         "featureRequests": ["string"],
         "bugReports": ["string"]
      }
    `;
  }
  if (type === 'optimize-listing') {
    return `
      You are an expert App Store Optimization (ASO) consultant.
      Analyze the following app metadata and optimize it for ranking.
      App Title: ${data.title}
      App Subtitle/Short Desc: ${data.subtitle}
      App Description Snippet: ${data.description.substring(0, 1000)}...
      
      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "suggestedKeywords": "string", // comma separated string of keywords
         "suggestedTitle": "string",
         "suggestedSubtitle": "string",
         "suggestedDescription": "string"
      }
    `;
  }
  if (type === 'generate-listing') {
    return `
      You are an expert App Store Optimization (ASO) consultant and App Marketer.
      Write highly optimized App Store and Google Play metadata entirely from scratch based on the following game/app concept:
      
      App Concept: ${data.prompt}
      Target Store: ${data.storeType === 'ios' ? 'Apple App Store' : 'Google Play Store'}
      
      === MARKET CONTEXT ===
      Target/Seed Keywords provided by user: ${data.targetKeywords || 'None provided'}
      Google Trends Multiplier (Interest & Trend logic): ${data.trendsContext || 'N/A'}
      Store Search Auto-suggestions (What users actually type): ${data.suggestContext || 'N/A'}
      
      Rules:
      1. Analyze the App Concept alongside the Target Keywords, Trends data, and Autosuggest data to determine the absolute best keyword combinations.
      2. The Title MUST be extremely catchy and contain the most important high-volume keyword identified from the available data.
      3. The Subtitle / Short Description MUST hook the user and include secondary keywords.
      4. Provide a list of 10-15 highly relevant, high-volume keywords this app should target, combining user seed keywords with the provided Search Autosuggestions.
      5. The Description MUST pitch the app perfectly to the user while naturally incorporating the keywords throughout. Do not make it look spammy.
      
      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "suggestedKeywords": "string", // comma separated string of keywords
         "suggestedTitle": "string",
         "suggestedSubtitle": "string",
         "suggestedDescription": "string"
      }
    `;
  }
  if (type === 'translate-listing') {
    return `
      You are an expert App Store Localization specialist.
      Translate the following App Store/Google Play metadata into the target language: ${data.targetLanguage}.
      Preserve any ASO keyword density, formatting, and character limits as best as possible in the target language.

      App Title: ${data.title}
      Subtitle / Short Description: ${data.subtitle}
      Full Description: ${data.description}

      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "translatedTitle": "string",
         "translatedSubtitle": "string",
         "translatedDescription": "string"
      }
    `;
  }
  if (type === 'competitor-keywords') {
    return `
      You are a world-class App Store Optimization expert.
      Extract the top 15 most important ranking keywords from the following competitor titles and summaries.

      Competitor Data:
      ${data.competitorText}

      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "keywords": [
           { "word": "keyword1", "count": 10 },
           { "word": "keyword2", "count": 8 }
         ]
      }
    `;
  }
  if (type === 'keyword-hunt') {
    return `
      You are a world-class App Store Optimization keyword researcher.
      Given the following app's metadata and its competitor landscape, generate a comprehensive keyword list.

      App Title: ${data.title}
      Subtitle / Short Desc: ${data.subtitle}
      Description Extract: ${data.description.substring(0, 800)}...
      Genre/Category: ${data.genre}
      Similar App Titles: ${data.similarApps}
      Google Trends Context (Middle Layer): ${data.trendsInfo || 'N/A'}
      Store Search Autosuggestions (Keyword Tool): ${data.suggestInfo || 'N/A'}
      Target Store: ${data.storeType === 'ios' ? 'Apple App Store' : 'Google Play Store'}

      Based on the app and the Google Trends context, generate 25-30 highly relevant keywords/phrases.
      For each keyword, estimate:
      - relevance: "High", "Medium", or "Low" (how relevant to this app)
      - difficulty: "Low", "Medium", or "High" (how hard to rank for)
      - strategy: a very short 5-10 word suggestion on how to use this keyword

      ALSO generate an optimized Title (max 30 chars), Short Description (max 80 chars),
      and a full, comprehensive Description (3000-4000 chars) that strategically incorporates the top keywords, outlines core features, and acts as a high-converting pitch.

      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "keywords": [
           { "keyword": "string", "relevance": "High", "difficulty": "Low", "strategy": "string" }
         ],
         "suggestedTitle": "string (max 30 chars)",
         "suggestedSubtitle": "string (max 80 chars)",
         "suggestedDescription": "string (3000-4000 chars, comprehensive and keyword-rich)"
      }
    `;
  }
  if (type === 'auto-discover-keywords') {
    return `
      You are an expert App Store Optimization keyword researcher.
      Given the following app metadata, generate a list of 10-15 highly relevant long-tail keywords that this specific app should be ranking for.
      Focus on specific, multi-word phrases that users would actually type to find an app with these specific features, avoiding overly generic single words.

      App Title: ${data.title}
      Subtitle / Short Desc: ${data.subtitle}
      Description Extract: ${data.description.substring(0, 1500)}...
      Target Store: ${data.storeType === 'ios' ? 'Apple App Store' : 'Google Play Store'}

      Respond ONLY with a valid JSON object matching this exact structure:
      {
         "keywords": ["long tail phrase 1", "long tail phrase 2", "long tail phrase 3"]
      }
    `;
  }
  if (type === 'portfolio-audit') {
    return `
      You are an elite App Store Optimization (ASO) Consultant performing a comprehensive audit.
      Analyze the following app metadata, its competitors, and user review sentiment.

      === APP METADATA ===
      App Title: ${data.title}
      Subtitle / Short Desc: ${data.subtitle}
      Description Extract: ${data.description.substring(0, 800)}...
      Store Rating: ${data.rating || 'N/A'}
      Reviews Count: ${data.reviewCount || 'N/A'}
      Installs: ${data.installs || 'N/A'}
      Recent Update Notes: ${data.recentChanges || 'N/A'}

      === TOP COMPETITOR TITLES ===
      ${data.competitorTitles || 'Not available'}

      === RECENT REVIEW SNIPPETS ===
      ${data.reviewSnippets || 'Not available'}

      === GOOGLE TRENDS DATA ===
      ${data.trendsInfo || 'Not available'}

      === REDDIT COMMUNITY BUZZ ===
      ${data.redditInfo || 'Not available'}

      Perform a deep audit and score the app across 6 key parameters.
      Analyze the Google Trends data to assess keyword seasonality and market interest.
      Analyze the Reddit data to understand community perception and viral potential.
      Also provide keyword suggestions you think are missing, competitor keyword gaps,
      insights from reviews, and 5 detailed actionable growth strategies.

      Respond ONLY with a valid JSON object matching this EXACT structure:
      {
         "overallScore": 72,
         "scoreBreakdown": {
            "titleOptimization": { "score": 80, "comment": "1-sentence explanation" },
            "subtitleOptimization": { "score": 65, "comment": "1-sentence explanation" },
            "descriptionQuality": { "score": 70, "comment": "1-sentence explanation" },
            "keywordCoverage": { "score": 60, "comment": "1-sentence explanation" },
            "competitivePosition": { "score": 75, "comment": "1-sentence explanation" },
            "reviewSentiment": { "score": 85, "comment": "1-sentence explanation" }
         },
         "currentKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
         "suggestedNewKeywords": ["new_kw1", "new_kw2", "new_kw3", "new_kw4", "new_kw5"],
         "competitorKeywordGaps": ["gap_kw1", "gap_kw2", "gap_kw3"],
         "reviewInsights": {
            "sentiment": "Mostly Positive",
            "topPraise": "string",
            "topComplaint": "string",
            "featureRequest": "string"
         },
         "trendInsight": "1-sentence on keyword trend direction and seasonality",
         "communityInsight": "1-sentence on Reddit/community perception",
         "potential": "2-sentence competitive potential summary incorporating all data",
         "growthStrategies": [
            { "title": "short title", "detail": "2-sentence actionable detail" },
            { "title": "short title", "detail": "2-sentence actionable detail" },
            { "title": "short title", "detail": "2-sentence actionable detail" },
            { "title": "short title", "detail": "2-sentence actionable detail" },
            { "title": "short title", "detail": "2-sentence actionable detail" }
         ]
      }
    `;
  }
  throw new Error('Invalid analysis type');
}
