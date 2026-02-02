"use client";

import { useState, useEffect } from 'react';
import Script from 'next/script';

// --- Type Definitions ---
interface SearchParams {
  q: string;
  maxResults: number;
  order: 'relevance' | 'date' | 'rating' | 'title' | 'videoCount' | 'viewCount';
  type: 'video' | 'channel' | 'playlist';
  videoDuration: 'any' | 'short' | 'medium' | 'long';
  videoDefinition: 'any' | 'high' | 'standard';
  regionCode: string;
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
  // Library States
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGapiReady, setIsGapiReady] = useState(false);

  // App States
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- NEW: Pagination States ---
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
  });

  // --- Robust Polling Initialization ---
  useEffect(() => {
    let gapiInitStarted = false;
    let gisInitStarted = false;

    const interval = setInterval(() => {
      if (typeof gapi !== 'undefined' && !gapiInitStarted) {
        gapiInitStarted = true;
        gapi.load('client', async () => {
          await gapi.client.init({
            apiKey: process.env.NEXT_PUBLIC_API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"],
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

  // --- Logic Handlers ---
  const handleAuth = () => {
    if (!tokenClient) return alert("Google Auth library not ready yet.");
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  };

  // --- UPDATED: handleSearch accepts an optional pageToken ---
  const handleSearch = async (e?: React.FormEvent, pageToken: string | null = null) => {
    if (e) e.preventDefault();
    if (!accessToken) return alert("Please authorize first!");

    setLoading(true);
    try {
      // @ts-ignore
      const response = await gapi.client.youtube.search.list({
        part: ['snippet'],
        pageToken: pageToken, // Pass the token here
        ...params
      });
      
      setResults(response.result.items.reverse() as YouTubeSearchResult[]);
      
      // Store the new tokens from response
      setNextPageToken(response.result.nextPageToken || null);
      setPrevPageToken(response.result.prevPageToken || null);

      // Scroll to top on page change
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black text-red-600">YT_SEARCH_API</h1>
            <p className="text-sm text-slate-500 font-medium">Type-Safe Explorer</p>
          </div>
          <button
            onClick={handleAuth}
            className={`px-6 py-2 rounded-lg font-bold transition shadow-sm ${accessToken ? 'bg-white border border-green-200 text-green-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {accessToken ? 'Authenticated ✓' : 'Connect Google Account'}
          </button>
        </header>

        <form onSubmit={(e) => handleSearch(e)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Search Keywords</label>
            <input
              type="text"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition"
              placeholder="What are you looking for?"
              value={params.q}
              onChange={e => setParams({ ...params, q: e.target.value })}
              required
            />
          </div>
          
          {/* ... Select fields remain the same ... */}
          {[
            { label: 'Sort Order', key: 'order', options: ['relevance', 'date', 'rating', 'title', 'viewCount'] },
            { label: 'Result Type', key: 'type', options: ['video', 'channel', 'playlist'] },
            { label: 'Duration', key: 'videoDuration', options: ['any', 'short', 'medium', 'long'] },
            { label: 'Resolution', key: 'videoDefinition', options: ['any', 'high', 'standard'] },
            { label: 'Max Results', key: 'maxResults', options: [5, 10, 15, 20, 25, 30, 40, 50] },
            { label: 'Region Code', key: 'regionCode', options: ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'JP'] },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{field.label}</label>
              <select
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none capitalize"
                value={params[field.key as keyof SearchParams]}
                onChange={e => setParams({ ...params, [field.key]: e.target.value })}
              >
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}

          <button
            type="submit"
            disabled={loading || !accessToken}
            className="md:col-span-4 bg-red-600 text-white py-4 rounded-xl font-black text-lg hover:bg-red-700 transition disabled:opacity-50 shadow-lg shadow-red-200"
          >
            {loading ? 'Searching...' : 'EXECUTE SEARCH'}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {results.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <div className="aspect-video relative bg-slate-200">
                <img src={item.snippet.thumbnails.medium.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="thumbnail" />
              </div>
              <div className="p-5">
                <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 leading-snug h-12" dangerouslySetInnerHTML={{ __html: item.snippet.title }} />
                <p className="text-xs font-semibold text-slate-400 mb-4">{item.snippet.channelTitle}</p>
                <a href={getUrl(item)} target="_blank" className="inline-block w-full text-center py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition">
                  VIEW ON YOUTUBE
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* --- NEW: Pagination Buttons --- */}
        {results.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-16 mb-20">
            <button
              onClick={() => handleSearch(undefined, prevPageToken)}
              disabled={loading || !prevPageToken}
              className="px-8 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
            >
              ← Previous Page
            </button>
            <button
              onClick={() => handleSearch(undefined, nextPageToken)}
              disabled={loading || !nextPageToken}
              className="px-8 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
            >
              Next Page →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}