'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Video {
  _id: string;
  title: string;
  videoSource: 'youtube' | 'upload' | 'gdrive';
  videoId?: string;
  gdriveId?: string;
  thumbnail?: string;
  duration: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await res.json();
      setVideos(data.videos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getThumbnail = (video: Video) => {
    if (video.thumbnail) return video.thumbnail;
    if (video.videoSource === 'youtube' && video.videoId) {
      return `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
    }
    return '/placeholder-video.png'; // You can add a placeholder image
  };

  const getSourceBadge = (source: string) => {
    const badges = {
      youtube: { text: 'YouTube', color: 'bg-red-500' },
      gdrive: { text: 'Google Drive', color: 'bg-blue-500' },
      upload: { text: 'Uploaded', color: 'bg-green-500' },
    };
    const badge = badges[source as keyof typeof badges];
    return (
      <span className={`${badge.color} text-white text-xs px-2 py-1 rounded`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">My Videos</h1>
          <div className="flex gap-3">
            <Link
              href="/video/new"
              className="px-4 py-2 text-white rounded-lg transition-colors font-medium"
              style={{ backgroundColor: '#00875F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006644')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
            >
              + New Video
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {videos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No videos yet. Create your first video!</p>
            <Link
              href="/video/new"
              className="inline-block px-6 py-3 text-white rounded-lg transition-colors font-medium"
              style={{ backgroundColor: '#00875F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006644')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
            >
              + Create Video
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link
                key={video._id}
                href={`/video/${video._id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-video bg-gray-200">
                  <img
                    src={getThumbnail(video)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    {getSourceBadge(video.videoSource)}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 truncate">{video.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
