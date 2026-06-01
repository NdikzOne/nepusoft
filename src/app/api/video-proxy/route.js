import { NextResponse } from 'next/server';
import cloudscraper from 'cloudscraper';
import { promisify } from 'util';

const cloudscraperPromise = promisify(cloudscraper);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json({ error: 'URL diperlukan' }, { status: 400 });
    }

    const response = await cloudscraperPromise({
      method: 'GET',
      uri: videoUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://animein.net/'
      },
      encoding: null
    });

    return new NextResponse(response, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}