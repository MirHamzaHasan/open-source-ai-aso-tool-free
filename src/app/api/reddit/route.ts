import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query) {
    return NextResponse.json({ success: false, error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    // Reddit's public JSON API — no auth needed
    const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=${limit}&t=year`;
    const res = await fetch(redditUrl, {
      headers: { 
        'User-Agent': 'DracoArts AI Based ASO/1.0 (ASO Research Tool)',
      },
    });

    if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);

    const data = await res.json();
    const posts = (data?.data?.children || []).map((child: any) => {
      const p = child.data;
      return {
        title: p.title,
        subreddit: p.subreddit_name_prefixed,
        score: p.score,
        numComments: p.num_comments,
        url: `https://reddit.com${p.permalink}`,
        selftext: (p.selftext || '').substring(0, 200),
        created: new Date(p.created_utc * 1000).toISOString(),
      };
    });

    // Quick sentiment summary
    const totalScore = posts.reduce((acc: number, p: any) => acc + p.score, 0);
    const avgScore = posts.length > 0 ? Math.round(totalScore / posts.length) : 0;

    return NextResponse.json({
      success: true,
      data: {
        query,
        postCount: posts.length,
        avgUpvotes: avgScore,
        communityBuzz: totalScore > 100 ? 'High' : totalScore > 20 ? 'Medium' : 'Low',
        posts,
      }
    });

  } catch (error: any) {
    console.error('Reddit API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Reddit data' },
      { status: 500 }
    );
  }
}
