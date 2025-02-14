import { NextResponse } from 'next/server';

const SERPAPI_KEY = 'fb7d1b8fd4c05bf868798208c1357662e8d0e043fdf774ea5164b877fd72f7bc';
const SERPAPI_URL = 'https://serpapi.com/search.json';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const searchUrl = new URL(SERPAPI_URL);
    searchUrl.searchParams.append('api_key', SERPAPI_KEY);
    searchUrl.searchParams.append('engine', 'youtube');
    searchUrl.searchParams.append('search_query', query);

    const response = await fetch(searchUrl.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to search YouTube');
    }

    // Transform the response to match our interface
    const videos = data.video_results?.map((video: any) => ({
      title: video.title,
      link: video.link,
      thumbnail: video.thumbnail.static,
      views: video.views,
      likes: video.number_of_likes
    })) || [];

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    );
  }
} 