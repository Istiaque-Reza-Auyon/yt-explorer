"use client";

import { useState, useEffect } from 'react';
import Script from 'next/script';

// --- Type Definitions ---
interface SearchParams {
  q: string;
  maxResults: number;
  order: 'relevance' | 'date' | 'rating' | 'title' | 'viewCount';
  type: 'video' | 'channel' | 'playlist';
  videoDuration: 'any' | 'short' | 'medium' | 'long';
  videoDefinition: 'any' | 'high' | 'standard';
  regionCode: string;
  publishedAfter: 'any' | 'week' | 'day'; // ✅ FIXED
}

interface YouTubeSearchResult {
  id: {
    videoId?: string;
    channelId?: string;
    playlistId?: string;
    kind: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      medium: { url: string };
    };
    channelTitle: string;
  };
}

export default function YouTubeExplorer() {
  const [tokenClient, setTokenClient] =
    useState<google.accounts.oauth2.TokenClient | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGapiReady, setIsGapiReady] = useState(false);

  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [prevPageToken, setPrevPageToken] = useState<string | null>(null);

  const [params, setParams] = useState<SearchParams>({
    q: '',
    maxResults: 50,
    order: 'relevance',
    type: 'video',
    videoDuration: 'any',
    videoDefinition: 'any',
    regionCode: 'US',
    publishedAfter: 'any' // ✅ FIXED
  });

  // --- Google Init ---
  useEffect(() => {
    let gapiInitStarted = false;
    let gisInitStarted = false;

    const interval = setInterval(() => {
      if (typeof gapi !== 'undefined' && !gapiInitStarted) {
        gapiInitStarted = true;
        gapi.load('client', async () => {
          await gapi.client.init({
            apiKey: process.env.NEXT_PUBLIC_API_KEY,
            discoveryDocs: [
              "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
            ],
          });
          setIsGapiReady(true);
        });
      }

      if (typeof google !== 'undefined' && google.accounts && !gisInitStarted) {
        gisInitStarted = true;
        const client = google.accounts.oauth2.initTokenClient({
          client_id: process.env.NEXT_PUBLIC_CLIENT_ID || '',
          scope: 'https://www.googleapis.com/auth/youtube.readonly',
          callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
              setAccessToken(tokenResponse.access_token);
            }
          },
        });
        setTokenClient(client);
      }

      if (gapiInitStarted && gisInitStarted) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAuth = () => {
    if (!tokenClient) return alert("Google Auth library not ready yet.");
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  };

  // --- Search ---
  const handleSearch = async (
    e?: React.FormEvent,
    pageToken: string | null = null
  ) => {
    if (e) e.preventDefault();
    if (!accessToken) return alert("Please authorize first!");

    setLoading(true);

    try {
      // ✅ Convert publishedAfter to RFC 3339 here
      let publishedAfterDate: string | undefined;

      if (params.publishedAfter === 'week') {
        publishedAfterDate = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
      } else if (params.publishedAfter === 'day') {
        publishedAfterDate = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
      } else if (params.publishedAfter === 'any') {
        publishedAfterDate = '1970-01-01T00:00:00Z';
      }

      // @ts-ignore
      const response = await gapi.client.youtube.search.list({
        part: ['snippet'],
        pageToken,
        ...params,
        publishedAfter: publishedAfterDate,
      });

      setResults(response.result.items as YouTubeSearchResult[]);
      setNextPageToken(response.result.nextPageToken || null);
      setPrevPageToken(response.result.prevPageToken || null);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getUrl = (item: YouTubeSearchResult) => {
    const { videoId, playlistId, channelId } = item.id;
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    if (playlistId) return `https://www.youtube.com/playlist?list=${playlistId}`;
    if (channelId) return `https://www.youtube.com/channel/${channelId}`;
    return "#";
  };

  const selectFields = [
    { label: 'Sort Order', key: 'order', options: ['relevance', 'date', 'rating', 'title', 'viewCount'] },
    { label: 'Result Type', key: 'type', options: ['video', 'channel', 'playlist'] },
    { label: 'Duration', key: 'videoDuration', options: ['any', 'short', 'medium', 'long'] },
    { label: 'Resolution', key: 'videoDefinition', options: ['any', 'high', 'standard'] },
    { label: 'Max Results', key: 'maxResults', options: [5, 10, 15, 20, 25, 30, 40, 50] },
    { label: 'Region Code', key: 'regionCode', options: ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'JP'] },
    {
      label: 'Published After',
      key: 'publishedAfter',
      options: [
        { label: 'Any Time', value: 'any' },
        { label: 'One Week Before', value: 'week' },
        { label: 'One Day Before', value: 'day' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black text-red-600">YT_SEARCH_API</h1>
          <button
            onClick={handleAuth}
            className={`px-6 py-2 rounded-lg font-bold ${
              accessToken
                ? 'bg-white border border-green-200 text-green-600'
                : 'bg-slate-900 text-white'
            }`}
          >
            {accessToken ? 'Authenticated ✓' : 'Connect Google Account'}
          </button>
        </header>

        <form
          onSubmit={(e) => handleSearch(e)}
          className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-4 mb-12"
        >
          <input
            type="text"
            className="md:col-span-4 p-3 border rounded-xl"
            placeholder="Search..."
            value={params.q}
            onChange={(e) => setParams({ ...params, q: e.target.value })}
            required
          />

          {selectFields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-bold block mb-1">
                {field.label}
              </label>

              <select
                className="w-full p-3 border rounded-xl"
                value={params[field.key as keyof SearchParams] as any}
                onChange={(e) =>
                  setParams({
                    ...params,
                    [field.key]:
                      field.key === 'maxResults'
                        ? Number(e.target.value)
                        : e.target.value,
                  } as SearchParams)
                }
              >
                {field.options.map((o: any) => (
                  <option
                    key={typeof o === 'object' ? o.value : o}
                    value={typeof o === 'object' ? o.value : o}
                  >
                    {typeof o === 'object' ? o.label : o}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            type="submit"
            disabled={loading || !accessToken}
            className="md:col-span-4 bg-red-600 text-white py-4 rounded-xl font-black"
          >
            {loading ? 'Searching...' : 'EXECUTE SEARCH'}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {results.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <img
                src={item.snippet.thumbnails.medium.url}
                className="w-full aspect-video object-cover"
                alt="thumbnail"
              />
              <div className="p-4">
                <h3
                  className="font-bold line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: item.snippet.title }}
                />
                <p className="text-xs text-slate-400 mb-3">
                  {item.snippet.channelTitle}
                </p>
                <a
                  href={getUrl(item)}
                  target="_blank"
                  className="text-red-600 text-sm font-bold"
                >
                  VIEW ON YOUTUBE
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
