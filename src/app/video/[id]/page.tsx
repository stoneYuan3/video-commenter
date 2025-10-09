'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Comment {
  _id: string;
  videoId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  text: string;
  timestamp?: number;
  timeRange?: { start: number; end: number };
  timeString: string;
  color: string;
  displayId?: string;
  createdAt: string;
}

interface Video {
  _id: string;
  title: string;
  videoSource: 'youtube' | 'upload' | 'gdrive';
  videoId?: string;
  gdriveId?: string;
  uploadedVideoUrl?: string;
  duration: number;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const videoIdParam = params?.id as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [hoveredComment, setHoveredComment] = useState<Comment | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const removalTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const ytApiLoadedRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const currentVideoIdRef = useRef<string>('');

  // Fetch video and comments on mount
  useEffect(() => {
    if (videoIdParam) {
      fetchVideoAndComments();
    }
  }, [videoIdParam]);

  const fetchVideoAndComments = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch video
      const videoRes = await fetch(`/api/videos/${videoIdParam}`);
      if (videoRes.status === 401) {
        router.push('/login');
        return;
      }
      if (!videoRes.ok) {
        throw new Error('Failed to fetch video');
      }
      const videoData = await videoRes.json();
      console.log('Fetched video data:', videoData.video);
      setVideo(videoData.video);

      // Get current user ID from the video owner (simple way)
      // In production, you'd get this from a /api/auth/me endpoint
      setCurrentUserId(videoData.video.userId);

      // Fetch comments
      const commentsRes = await fetch(`/api/comments?videoId=${videoIdParam}`);
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData.comments);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load YouTube IFrame API on mount
  useEffect(() => {
    // Load the API script if not already present
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Set up callback for when API loads
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoadedRef.current = true;
    };

    return () => {
      // Cleanup on unmount
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      playerInitializedRef.current = false;
      currentVideoIdRef.current = '';
    };
  }, []);

  // Reset initialization flag when video changes
  useEffect(() => {
    if (video?.videoSource !== 'youtube') {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      playerInitializedRef.current = false;
      currentVideoIdRef.current = '';
    }
  }, [video?.videoSource, video?.videoId]);

  // Callback ref for YouTube player div - called when div is rendered
  const youtubePlayerCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node || !video || video.videoSource !== 'youtube' || !video.videoId) {
      return;
    }

    // Check if already initialized with the same video
    if (playerInitializedRef.current && currentVideoIdRef.current === video.videoId && playerRef.current) {
      return;
    }

    // Destroy existing player if any
    if (playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const createPlayer = () => {
      try {
        playerRef.current = new window.YT.Player(node, {
          height: '480',
          width: '100%',
          videoId: video.videoId,
          playerVars: {
            'playsinline': 1,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0
          },
          events: {
            'onReady': onPlayerReady,
          }
        });
        playerInitializedRef.current = true;
        currentVideoIdRef.current = video.videoId || '';
      } catch (error) {
        console.error('Error creating YouTube player:', error);
      }
    };

    // Check if YouTube API is ready
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      // Wait for API to load
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          createPlayer();
        }
      }, 100);

      // Cleanup interval after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }, [video]);

  const onPlayerReady = () => {
    const dur = playerRef.current.getDuration();
    setDuration(dur);

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
      }
    }, 100);

    return () => clearInterval(interval);
  };

  // Handle custom video player time updates (for upload)
  useEffect(() => {
    if (!video || video.videoSource !== 'upload' || !videoRef.current) return;

    const videoEl = videoRef.current;

    const updateTime = () => setCurrentTime(videoEl.currentTime);
    const updateDuration = () => setDuration(videoEl.duration);
    const updatePlayState = () => setIsPlaying(!videoEl.paused);

    videoEl.addEventListener('timeupdate', updateTime);
    videoEl.addEventListener('loadedmetadata', updateDuration);
    videoEl.addEventListener('play', updatePlayState);
    videoEl.addEventListener('pause', updatePlayState);

    return () => {
      videoEl.removeEventListener('timeupdate', updateTime);
      videoEl.removeEventListener('loadedmetadata', updateDuration);
      videoEl.removeEventListener('play', updatePlayState);
      videoEl.removeEventListener('pause', updatePlayState);
    };
  }, [video]);

  // Show comments when timestamp matches
  useEffect(() => {
    const matchingComments = comments.filter(comment => {
      if (comment.timestamp !== undefined) {
        return Math.abs(comment.timestamp - currentTime) < 1;
      } else if (comment.timeRange) {
        return currentTime >= comment.timeRange.start && currentTime <= comment.timeRange.end;
      }
      return false;
    });

    const matchingIds = new Set(matchingComments.map(c => c._id));

    setDisplayedComments(prev => {
      const existingIds = new Set(prev.map(c => c._id));
      const toAdd = matchingComments
        .filter(c => !existingIds.has(c._id))
        .map(comment => ({
          ...comment,
          displayId: `${comment._id}-${Date.now()}`
        }));

      matchingIds.forEach(id => {
        const timeout = removalTimeoutsRef.current.get(id);
        if (timeout) {
          clearTimeout(timeout);
          removalTimeoutsRef.current.delete(id);
        }
      });

      return [...prev, ...toAdd];
    });

    setDisplayedComments(prev => {
      prev.forEach(comment => {
        const isMatching = matchingIds.has(comment._id);
        const hasTimeout = removalTimeoutsRef.current.has(comment._id);

        if (!isMatching && !hasTimeout) {
          const timeout = setTimeout(() => {
            setDisplayedComments(current =>
              current.filter(c => c.displayId !== comment.displayId)
            );
            removalTimeoutsRef.current.delete(comment._id);
          }, 4000);

          removalTimeoutsRef.current.set(comment._id, timeout);
        }
      });

      return prev;
    });
  }, [currentTime, comments]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeRange = (start: number, end: number): string => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const generateRandomColor = (): string => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
      '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
      '#a855f7', '#ec4899', '#f43f5e',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const addComment = async () => {
    if (!newComment.trim() || !video) return;

    const commentData = {
      videoId: video._id,
      text: newComment,
      timeString: selectedRange
        ? formatTimeRange(selectedRange.start, selectedRange.end)
        : formatTime(currentTime),
      color: generateRandomColor(),
      ...(selectedRange
        ? { timeRange: selectedRange }
        : { timestamp: currentTime }),
    };

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      if (!res.ok) {
        throw new Error('Failed to add comment');
      }

      const data = await res.json();
      setComments(prev => [...prev, data.comment].sort((a, b) => {
        const aTime = a.timestamp ?? a.timeRange?.start ?? 0;
        const bTime = b.timestamp ?? b.timeRange?.start ?? 0;
        return aTime - bTime;
      }));
      setNewComment('');
      setSelectedRange(null);
    } catch (err: any) {
      console.error('Add comment error:', err);
      alert('Failed to add comment');
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.text);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const saveEdit = async (commentId: string) => {
    if (!editText.trim()) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      });

      if (!res.ok) {
        throw new Error('Failed to update comment');
      }

      const data = await res.json();
      setComments(prev => prev.map(c => c._id === commentId ? data.comment : c));
      setEditingCommentId(null);
      setEditText('');
    } catch (err: any) {
      console.error('Edit comment error:', err);
      alert('Failed to edit comment');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete comment');
      }

      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err: any) {
      console.error('Delete comment error:', err);
      alert('Failed to delete comment');
    }
  };

  const jumpToTime = (timestamp: number, shouldPause: boolean = false) => {
    if (!video) return;

    if (video.videoSource === 'youtube' && playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      if (shouldPause) {
        playerRef.current.pauseVideo();
      }
    } else if (video.videoSource === 'upload' && videoRef.current) {
      videoRef.current.currentTime = timestamp;
      if (shouldPause) {
        videoRef.current.pause();
      }
    }
  };

  const getTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration, position * duration));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    if (newComment.trim() && selectedRange) {
      addComment();
    }

    const time = getTimeFromPosition(e.clientX);
    jumpToTime(time, false);
    setSelectedRange(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const time = getTimeFromPosition(e.clientX);
    setIsDragging(true);
    setDragStart(time);
    setHasDragged(false);
    setSelectedRange({ start: time, end: time });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || dragStart === null) return;

    const time = getTimeFromPosition(e.clientX);
    const start = Math.min(dragStart, time);
    const end = Math.max(dragStart, time);

    if (Math.abs(end - start) > 0.1) {
      setHasDragged(true);
      if (video?.videoSource === 'upload' && videoRef.current && !hasDragged) {
        videoRef.current.pause();
      }
    }

    setSelectedRange({ start, end });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleMouseUp();
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [video]);

  const getSelectionStyle = () => {
    if (!selectedRange || duration === 0) return {};
    const startPercent = (selectedRange.start / duration) * 100;
    const widthPercent = ((selectedRange.end - selectedRange.start) / duration) * 100;
    return {
      left: `${startPercent}%`,
      width: `${widthPercent}%`
    };
  };

  const togglePlayPause = () => {
    if (!video) return;

    if (video.videoSource === 'youtube' && playerRef.current) {
      const state = playerRef.current.getPlayerState();
      if (state === 1) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } else if (video.videoSource === 'upload' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Video not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: '#00875F' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">{video.title}</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Video embed */}
            <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
              {video.videoSource === 'youtube' && (
                <div
                  ref={youtubePlayerCallback}
                  className="rounded"
                />
              )}

              {video.videoSource === 'upload' && video.uploadedVideoUrl && (
                <div className="relative rounded overflow-hidden bg-black flex items-center justify-center" style={{ height: '480px' }}>
                  <video
                    ref={videoRef}
                    src={video.uploadedVideoUrl}
                    className="max-h-full max-w-full"
                    style={{ objectFit: 'contain' }}
                    onClick={togglePlayPause}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ opacity: isPlaying ? 0 : 1, transition: 'opacity 0.3s' }}
                  >
                    <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {video.videoSource === 'gdrive' && video.gdriveId && (
                <div className="rounded overflow-hidden bg-black" style={{ height: '480px' }}>
                  <iframe
                    src={`https://drive.google.com/file/d/${video.gdriveId}/preview`}
                    width="100%"
                    height="480"
                    allow="autoplay"
                    className="rounded"
                    title="Google Drive Video"
                  />
                </div>
              )}

              {/* Custom Timeline */}
              <div className="mt-4">
                {hoveredComment && (
                  <div className="relative mb-2">
                    <div
                      className="absolute bottom-0 px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs z-50 animate-fade-in"
                      style={{
                        backgroundColor: hoveredComment.color,
                        color: 'white',
                        left: hoveredComment.timeRange
                          ? `${((hoveredComment.timeRange.start / duration) * 100)}%`
                          : `${((hoveredComment.timestamp ?? 0) / duration) * 100}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <div className="font-semibold mb-1">{hoveredComment.timeString}</div>
                      <div className="text-white/90">{hoveredComment.text}</div>
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
                        style={{ borderTopColor: hoveredComment.color }}
                      />
                    </div>
                  </div>
                )}

                <div
                  ref={timelineRef}
                  className="relative h-12 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
                  onClick={handleTimelineClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  style={{ userSelect: 'none' }}
                >
                  {/* Comment labels on timeline */}
                  {comments.map(comment => {
                    if (comment.timeRange && duration > 0) {
                      const startPercent = (comment.timeRange.start / duration) * 100;
                      const widthPercent = ((comment.timeRange.end - comment.timeRange.start) / duration) * 100;
                      return (
                        <div
                          key={comment._id}
                          className="absolute top-0 h-full opacity-40 pointer-events-auto border-l-2 border-r-2 hover:opacity-60 transition-opacity cursor-pointer z-10"
                          style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                            backgroundColor: comment.color,
                            borderColor: comment.color
                          }}
                          onMouseEnter={() => setHoveredComment(comment)}
                          onMouseLeave={() => setHoveredComment(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const time = getTimeFromPosition(e.clientX);
                            jumpToTime(time, false);
                          }}
                        />
                      );
                    } else if (comment.timestamp !== undefined && duration > 0) {
                      const position = (comment.timestamp / duration) * 100;
                      return (
                        <div
                          key={comment._id}
                          className="absolute top-0 w-1 h-full pointer-events-auto hover:w-2 transition-all cursor-pointer z-10"
                          style={{
                            left: `${position}%`,
                            backgroundColor: comment.color
                          }}
                          onMouseEnter={() => setHoveredComment(comment)}
                          onMouseLeave={() => setHoveredComment(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToTime(comment.timestamp ?? 0, false);
                          }}
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Progress bar */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-400 rounded-lg pointer-events-none z-0"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />

                  {/* Selected range highlight */}
                  {selectedRange && (
                    <div
                      className="absolute top-0 h-full bg-yellow-400 opacity-60 pointer-events-none border-2 border-yellow-600 z-20"
                      style={getSelectionStyle()}
                    />
                  )}

                  {/* Current time indicator */}
                  <div
                    className="absolute top-0 w-1 h-full bg-red-500 pointer-events-none z-30"
                    style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />

                  {/* Time display on timeline */}
                  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                    <span className="text-sm font-mono text-gray-700">{formatTime(currentTime)}</span>
                    <span className="text-sm font-mono text-gray-700">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex items-center gap-4 mt-3">
                  {selectedRange && (
                    <div className="text-sm text-gray-600">
                      Selected: {formatTimeRange(selectedRange.start, selectedRange.end)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add comment interface */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Comment</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addComment()}
                  placeholder="Add a comment at the current timestamp..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                />
                <button
                  onClick={addComment}
                  className="px-6 py-2 text-white rounded-lg transition-colors font-medium"
                  style={{ backgroundColor: '#00875F' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006644')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
                >
                  Add
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {selectedRange
                  ? `Comment will be added to range: ${formatTimeRange(selectedRange.start, selectedRange.end)}`
                  : `Comment will be added at: ${formatTime(currentTime)}`
                }
              </div>
            </div>

            {/* Comments list */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Comments</h2>
              {comments.length === 0 ? (
                <p className="text-gray-500 italic">No comments yet. Add one above!</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(comment => (
                    <div
                      key={comment._id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      style={{ borderLeftWidth: '4px', borderLeftColor: comment.color }}
                    >
                      {editingCommentId === comment._id ? (
                        <div>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-2"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(comment._id)}
                              className="px-3 py-1 text-white rounded text-sm"
                              style={{ backgroundColor: '#00875F' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <button
                              onClick={() => jumpToTime(comment.timestamp ?? comment.timeRange?.start ?? 0, false)}
                              className="text-blue-500 hover:text-blue-700 font-mono text-sm font-semibold mb-2 hover:underline flex items-center gap-2"
                            >
                              {comment.timeRange && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                                  RANGE
                                </span>
                              )}
                              {comment.timeString}
                            </button>
                            <p className="text-gray-800 mb-1">{comment.text}</p>
                            <p className="text-xs text-gray-500">
                              By {comment.userId.name} • {new Date(comment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {comment.userId._id === currentUserId && (
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => startEdit(comment)}
                                className="text-blue-600 hover:text-blue-700 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteComment(comment._id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Timestamp Comments</h2>
              <div className="min-h-[200px]">
                {displayedComments.length > 0 ? (
                  <div className="space-y-3">
                    {displayedComments.map(comment => (
                      <div
                        key={comment.displayId}
                        className={`border rounded-lg p-4 animate-fade-in ${
                          comment.timeRange
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {comment.timeRange && (
                            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-semibold">
                              RANGE
                            </span>
                          )}
                          <div className={`font-mono text-sm font-semibold ${
                            comment.timeRange ? 'text-yellow-700' : 'text-blue-600'
                          }`}>
                            {comment.timeString}
                          </div>
                        </div>
                        <p className="text-gray-800">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">
                    Comments will appear here when the video reaches their timestamp
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
