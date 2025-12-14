'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VideoInput {
  id: number;
  url: string;
}

export default function NewVideoPage() {
  const [title, setTitle] = useState('');
  const [videoInputs, setVideoInputs] = useState<VideoInput[]>([{ id: 0, url: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
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

  const addVideoInput = () => {
    setVideoInputs(prev => [
      ...prev,
      { id: Date.now(), url: '' }
    ]);
  };

  const removeVideoInput = (id: number) => {
    setVideoInputs(prev => prev.filter(input => input.id !== id));
  };

  const updateVideoUrl = (id: number, url: string) => {
    setVideoInputs(prev => prev.map(input =>
      input.id === id ? { ...input, url } : input
    ));
  };

  const handleCreateVideo = async () => {
    if (!title.trim()) {
      setError('Please enter a project name');
      return;
    }

    const validVideos = videoInputs
      .filter(input => input.url.trim())
      .map((input, index) => {
        const videoId = extractYouTubeId(input.url);
        if (!videoId) return null;
        return {
          videoSource: 'youtube' as const,
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          order: index
        };
      })
      .filter(v => v !== null);

    if (validVideos.length === 0) {
      setError('Please add at least one valid YouTube URL');
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
          videos: validVideos,
          // Backward compatibility
          videoSource: 'youtube',
          videoId: validVideos[0].videoId,
          thumbnail: validVideos[0].thumbnail,
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

          {/* Project Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            />
          </div>

          {/* Video List */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video List
            </label>

            {videoInputs.map((input, index) => (
              <div key={input.id} className="mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">
                      YouTube URL
                      {index > 0 && (
                        <button
                          onClick={() => removeVideoInput(input.id)}
                          className="ml-2 text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </label>
                    <input
                      type="text"
                      value={input.url}
                      onChange={(e) => updateVideoUrl(input.id, e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={addVideoInput}
              className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-lg mr-2">+</span>
              Add another video to the reel
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateVideo}
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
