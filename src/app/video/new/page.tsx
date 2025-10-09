'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewVideoPage() {
  const [title, setTitle] = useState('');
  const [videoSource, setVideoSource] = useState<'youtube' | 'upload' | 'gdrive' | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const extractGoogleDriveId = (url: string): string | null => {
    const patterns = [
      /drive\.google\.com\/file\/d\/([^/]+)/,
      /drive\.google\.com\/open\?id=([^&]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleYouTubeSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a video title');
      return;
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          videoSource: 'youtube',
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create video');
      }

      router.push(`/video/${data.video._id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDriveSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a video title');
      return;
    }

    const gdriveId = extractGoogleDriveId(gdriveUrl);
    if (!gdriveId) {
      setError('Invalid Google Drive URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          videoSource: 'gdrive',
          gdriveId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create video');
      }

      router.push(`/video/${data.video._id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!title.trim()) {
      setError('Please enter a video title first');
      e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Note: For uploaded videos, we'll need to implement file upload to cloud storage
    // For now, we'll show an error
    setError('File upload feature requires cloud storage setup (AWS S3, Cloudflare R2, etc.)');
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Create New Video</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          </div>

          {/* Video Source Selection */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Choose Video Source</h2>

            {/* YouTube URL Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleYouTubeSubmit()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                />
                <button
                  onClick={handleYouTubeSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                  style={{ backgroundColor: '#00875F' }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#006644')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            {/* Commented out for now - Google Drive and File Upload */}
            {/* <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-xs">OR</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div> */}

            {/* Google Drive URL Input */}
            {/* <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Google Drive URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gdriveUrl}
                  onChange={(e) => setGdriveUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGoogleDriveSubmit()}
                  placeholder="https://drive.google.com/file/d/..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                />
                <button
                  onClick={handleGoogleDriveSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                  style={{ backgroundColor: '#00875F' }}
                  onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#006644')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div> */}

            {/* <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-xs">OR</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div> */}

            {/* Video Upload */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Video File
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="mt-2 text-xs text-gray-500">
                Note: File uploads require cloud storage configuration
              </p>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
