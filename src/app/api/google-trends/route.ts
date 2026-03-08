import { NextResponse } from 'next/server';
import googleTrends from 'google-trends-api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const geo = searchParams.get('geo') || '';

  if (!keyword) {
    return NextResponse.json({ success: false, error: 'Missing keyword parameter' }, { status: 400 });
  }

  try {
    // Interest Over Time (last 12 months)
    const interestRaw = await googleTrends.interestOverTime({
      keyword,
      startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: geo.toUpperCase(),
    });
    const interestData = JSON.parse(interestRaw);
    const timeline = (interestData.default?.timelineData || []).map((p: any) => ({
      date: p.formattedAxisTime,
      value: p.value?.[0] || 0,
    }));

    // Related Queries
    let relatedQueries: string[] = [];
    try {
      const relatedRaw = await googleTrends.relatedQueries({ keyword, geo: geo.toUpperCase() });
      const relatedData = JSON.parse(relatedRaw);
      const topQueries = relatedData.default?.rankedList?.[0]?.rankedKeyword || [];
      relatedQueries = topQueries.slice(0, 10).map((q: any) => q.query);
    } catch {}

    // Current interest (latest data point)
    const currentInterest = timeline.length > 0 ? timeline[timeline.length - 1].value : 0;
    const peakInterest = Math.max(...timeline.map((t: any) => t.value), 0);

    return NextResponse.json({
      success: true,
      data: {
        keyword,
        currentInterest,
        peakInterest,
        timeline: timeline.slice(-12), // last 12 data points for compact display
        relatedQueries,
        trendDirection: timeline.length >= 2
          ? timeline[timeline.length - 1].value >= timeline[timeline.length - 2].value ? 'rising' : 'falling'
          : 'stable',
      }
    });

  } catch (error: any) {
    console.error('Google Trends Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Google Trends data' },
      { status: 500 }
    );
  }
}
