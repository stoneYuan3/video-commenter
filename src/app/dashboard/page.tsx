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
  permission?: 'invited-only' | 'anyone-view' | 'anyone-edit';
  invitedUsers?: any[];
  userId?: any;
  createdAt: string;
  lastOpenedAt?: string;
}

export default function DashboardPage() {
  const [allVideos, setAllVideos] = useState<Video[]>([]); // All accessible videos
  const [myVideos, setMyVideos] = useState<Video[]>([]); // Only owned videos
  const [activeTab, setActiveTab] = useState<'dashboard' | 'my-videos'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      // Get current user ID
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUserId(userData.userId);
      }

      // Fetch all accessible videos (owned + shared)
      const accessibleRes = await fetch('/api/videos/accessible');
      if (accessibleRes.status === 401) {
        router.push('/login');
        return;
      }
      if (!accessibleRes.ok) {
        throw new Error('Failed to fetch accessible videos');
      }
      const accessibleData = await accessibleRes.json();
      setAllVideos(accessibleData.videos);

      // Fetch only owned videos
      const ownedRes = await fetch('/api/videos');
      if (ownedRes.status === 401) {
        router.push('/login');
        return;
      }
      if (!ownedRes.ok) {
        throw new Error('Failed to fetch owned videos');
      }
      const ownedData = await ownedRes.json();
      setMyVideos(ownedData.videos);
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

  const deleteVideo = async (videoId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to video page
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete video');
      }

      // Remove video from both states
      setAllVideos(prev => prev.filter(v => v._id !== videoId));
      setMyVideos(prev => prev.filter(v => v._id !== videoId));
    } catch (err: any) {
      console.error('Delete video error:', err);
      alert('Failed to delete video: ' + err.message);
    }
  };

  const updatePermission = async (videoId: string, permission: string) => {
    try {
      const res = await fetch(`/api/videos/${videoId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission }),
      });

      if (!res.ok) {
        throw new Error('Failed to update permission');
      }

      const data = await res.json();
      // Update both video lists
      setAllVideos(prev => prev.map(v => v._id === videoId ? data.video : v));
      setMyVideos(prev => prev.map(v => v._id === videoId ? data.video : v));
      setShowPermissionModal(false);
    } catch (err: any) {
      console.error('Update permission error:', err);
      alert('Failed to update permission: ' + err.message);
    }
  };

  const inviteUser = async () => {
    if (!selectedVideo || !inviteEmail.trim()) return;

    try {
      const res = await fetch(`/api/videos/${selectedVideo._id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite user');
      }

      const data = await res.json();
      // Update both video lists
      setAllVideos(prev => prev.map(v => v._id === selectedVideo._id ? data.video : v));
      setMyVideos(prev => prev.map(v => v._id === selectedVideo._id ? data.video : v));
      setInviteEmail('');
      setShowInviteModal(false);
      alert(`Successfully invited ${inviteEmail}`);
    } catch (err: any) {
      console.error('Invite user error:', err);
      alert(err.message);
    }
  };

  const openPermissionModal = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(video);
    setShowPermissionModal(true);
  };

  const openInviteModal = (video: Video, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVideo(video);
    setShowInviteModal(true);
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
          <h1 className="text-2xl font-bold text-gray-800">
            {activeTab === 'dashboard' ? 'Dashboard' : 'My Videos'}
          </h1>
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

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-medium transition-colors ${activeTab === 'dashboard'
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('my-videos')}
              className={`px-6 py-3 font-medium transition-colors ${activeTab === 'my-videos'
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              My Videos
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

        {(() => {
          const currentVideos = activeTab === 'dashboard' ? allVideos : myVideos;

          return currentVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {activeTab === 'dashboard'
                  ? 'No videos available. Create your first video or wait to be invited to one!'
                  : 'No videos yet. Create your first video!'}
              </p>
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
              {currentVideos.map((video) => {
                const isOwner = video.userId?._id === currentUserId || video.userId === currentUserId;
                return (
                  <div key={video._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative group">
                    <Link href={`/video/${video._id}`}>
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
                      <div className="p-4 flex flex-row items-center w-full justify-between">
                        <div className='flex flex-col'>
                          <h3 className="font-semibold text-gray-800 mb-1 truncate">{video.title}</h3>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500">
                              {new Date(video.createdAt).toLocaleDateString()}
                            </p>
                            {isOwner && (
                              <button
                                onClick={(e) => openPermissionModal(video, e)}
                                className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                                title="Click to adjust permissions"
                              >
                                {video.permission === 'invited-only' && '🔒 Invited Only'}
                                {video.permission === 'anyone-view' && '👁️ Anyone View'}
                                {video.permission === 'anyone-edit' && '✏️ Anyone Edit'}
                                {!video.permission && '🔒 Invited Only'}
                              </button>
                            )}

                          </div>
                        </div>
                        {!isOwner && (
                          <span className="text-sm px-3 py-1 rounded-full font-semibold">
                            Shared with you
                          </span>
                        )}
                        {isOwner && (
                          <div className="flex gap-2">
                            {/* Invite User Icon */}
                            <button
                              onClick={(e) => openInviteModal(video, e)}
                              className="h-fit transition-opacity hover:opacity-50"
                              title="Invite user"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                              </svg>
                            </button>

                            {/* Delete Icon */}
                            <button
                              onClick={(e) => deleteVideo(video._id, e)}
                              className="h-fit transition-opacity hover:opacity-50"
                              title="Delete video"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </Link>

                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Permission Modal */}
      {showPermissionModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPermissionModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Adjust Permissions</h2>
            <p className="text-sm text-gray-600 mb-4">Video: {selectedVideo.title}</p>
            <div className="space-y-3">
              <button
                onClick={() => updatePermission(selectedVideo._id, 'invited-only')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${(selectedVideo.permission || 'invited-only') === 'invited-only'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <div className="font-semibold text-gray-800">Invited Only</div>
                <div className="text-sm text-gray-600">Only invited users can view and comment</div>
              </button>
              <button
                onClick={() => updatePermission(selectedVideo._id, 'anyone-view')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${(selectedVideo.permission || 'invited-only') === 'anyone-view'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <div className="font-semibold text-gray-800">Anyone Can View</div>
                <div className="text-sm text-gray-600">Anyone with link can view, invited users can comment</div>
              </button>
              <button
                onClick={() => updatePermission(selectedVideo._id, 'anyone-edit')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${(selectedVideo.permission || 'invited-only') === 'anyone-edit'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <div className="font-semibold text-gray-800">Anyone Can Edit</div>
                <div className="text-sm text-gray-600">Anyone with link can view and comment (requires account)</div>
              </button>
            </div>
            <button
              onClick={() => setShowPermissionModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-gray-800">Invite User</h2>
            <p className="text-sm text-gray-600 mb-4">Video: {selectedVideo.title}</p>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && inviteUser()}
              placeholder="Enter email address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={inviteUser}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Invite
              </button>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
