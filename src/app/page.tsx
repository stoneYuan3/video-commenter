'use client';

import { useState, useRef, useEffect } from 'react';

interface Comment {
  id: string;
  timestamp?: number;
  timeRange?: { start: number; end: number };
  text: string;
  timeString: string;
  displayId?: string;
  color?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function Home() {
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
  const [videoSource, setVideoSource] = useState<'youtube' | 'upload' | 'gdrive' | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [gdriveId, setGdriveId] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const removalTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load YouTube IFrame API
  useEffect(() => {
    if (videoSource !== 'youtube') return;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '480',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'playsinline': 1,
          'controls': 0, // Hide default controls
          'modestbranding': 1,
          'rel': 0
        },
        events: {
          'onReady': onPlayerReady,
        }
      });
    };
  }, [videoSource, videoId]);

  // Handle custom video player time updates (for upload only)
  useEffect(() => {
    if (videoSource !== 'upload' || !videoRef.current) return;

    const video = videoRef.current;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    const updateDuration = () => {
      setDuration(video.duration);
    };

    const updatePlayState = () => {
      setIsPlaying(!video.paused);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', updatePlayState);
    video.addEventListener('pause', updatePlayState);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', updatePlayState);
      video.removeEventListener('pause', updatePlayState);
    };
  }, [videoSource]);

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

    // Get IDs of currently matching comments
    const matchingIds = new Set(matchingComments.map(c => c.id));

    // Add new matching comments and clear any pending removal timeouts
    setDisplayedComments(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      const toAdd = matchingComments
        .filter(c => !existingIds.has(c.id))
        .map(comment => ({
          ...comment,
          displayId: `${comment.id}-${Date.now()}`
        }));

      // Clear removal timeouts for comments that are now matching again
      matchingIds.forEach(id => {
        const timeout = removalTimeoutsRef.current.get(id);
        if (timeout) {
          clearTimeout(timeout);
          removalTimeoutsRef.current.delete(id);
        }
      });

      return [...prev, ...toAdd];
    });

    // Schedule removal for comments that are no longer matching (with 4 second delay)
    setDisplayedComments(prev => {
      prev.forEach(comment => {
        const isMatching = matchingIds.has(comment.id);
        const hasTimeout = removalTimeoutsRef.current.has(comment.id);

        // If comment is no longer matching and doesn't have a pending removal timeout
        if (!isMatching && !hasTimeout) {
          const timeout = setTimeout(() => {
            setDisplayedComments(current =>
              current.filter(c => c.displayId !== comment.displayId)
            );
            removalTimeoutsRef.current.delete(comment.id);
          }, 4000);

          removalTimeoutsRef.current.set(comment.id, timeout);
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
      '#ef4444', // red
      '#f97316', // orange
      '#f59e0b', // amber
      '#84cc16', // lime
      '#10b981', // emerald
      '#14b8a6', // teal
      '#06b6d4', // cyan
      '#3b82f6', // blue
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#a855f7', // purple
      '#ec4899', // pink
      '#f43f5e', // rose
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

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

  const handleYouTubeSubmit = () => {
    const id = extractYouTubeId(youtubeUrl);
    if (id) {
      setVideoId(id);
      setVideoSource('youtube');
    }
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

  const handleGoogleDriveSubmit = () => {
    const id = extractGoogleDriveId(gdriveUrl);
    if (id) {
      setGdriveId(id);
      setVideoSource('gdrive');
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideo(url);
      setVideoSource('upload');
    }
  };

  const addComment = () => {
    if (newComment.trim()) {
      const comment: Comment = selectedRange
        ? {
            id: Date.now().toString(),
            timeRange: selectedRange,
            text: newComment,
            timeString: formatTimeRange(selectedRange.start, selectedRange.end),
            color: generateRandomColor()
          }
        : {
            id: Date.now().toString(),
            timestamp: currentTime,
            text: newComment,
            timeString: formatTime(currentTime),
            color: generateRandomColor()
          };

      setComments(prev => [...prev, comment].sort((a, b) => {
        const aTime = a.timestamp ?? a.timeRange?.start ?? 0;
        const bTime = b.timestamp ?? b.timeRange?.start ?? 0;
        return aTime - bTime;
      }));
      setNewComment('');
      setSelectedRange(null);
    }
  };

  const jumpToTime = (timestamp: number, shouldPause: boolean = false) => {
    if (videoSource === 'youtube' && playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      if (shouldPause) {
        playerRef.current.pauseVideo();
      }
    } else if (videoSource === 'upload' && videoRef.current) {
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
    // Don't process click if it was a drag
    if (hasDragged) {
      setHasDragged(false);
      return;
    }

    // Auto-submit existing comment if any
    if (newComment.trim() && selectedRange) {
      addComment();
    }

    const time = getTimeFromPosition(e.clientX);
    jumpToTime(time, false); // Don't pause on click
    setSelectedRange(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent text selection

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

    // Mark as dragged if moved more than 0.1 seconds
    if (Math.abs(end - start) > 0.1) {
      setHasDragged(true);
      // Pause video on first drag movement
      if (playerRef.current && !hasDragged) {
        playerRef.current.pauseVideo();
      }
    }

    setSelectedRange({ start, end });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);

      // Auto-submit comment if there's text and a valid range was selected
      if (hasDragged && newComment.trim() && selectedRange) {
        // Don't auto-submit here, wait for user to click Add or make new selection
      }
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleMouseUp();
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Spacebar hotkey for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    if (videoSource === 'youtube' && playerRef.current) {
      const state = playerRef.current.getPlayerState();
      if (state === 1) { // Playing
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } else if (videoSource === 'upload' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Video Commenter</h1>

        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1">
            {/* Video source selection */}
            {!videoSource && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Choose Video Source</h2>

                {/* YouTube URL Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube URL
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleYouTubeSubmit()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    />
                    <button
                      onClick={handleYouTubeSubmit}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                    >
                      Load
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-gray-500 text-sm">OR</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                {/* Google Drive URL Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Drive URL
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={gdriveUrl}
                      onChange={(e) => setGdriveUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGoogleDriveSubmit()}
                      placeholder="https://drive.google.com/file/d/..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    />
                    <button
                      onClick={handleGoogleDriveSubmit}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                    >
                      Load
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-gray-500 text-sm">OR</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Video File
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Video embed */}
            {videoSource && (
              <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
                {videoSource === 'youtube' && (
                  <div
                    id="youtube-player"
                    ref={playerDivRef}
                    className="rounded"
                  />
                )}

                {videoSource === 'upload' && uploadedVideo && (
                  <div className="relative rounded overflow-hidden bg-black flex items-center justify-center" style={{ height: '480px' }}>
                    <video
                      ref={videoRef}
                      src={uploadedVideo}
                      className="max-h-full max-w-full"
                      style={{ objectFit: 'contain' }}
                      onClick={togglePlayPause}
                    />
                    {/* Play/Pause overlay */}
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ opacity: isPlaying ? 0 : 1, transition: 'opacity 0.3s' }}
                    >
                      <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-white ml-1"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Pause icon overlay */}
                    {isPlaying && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
                        style={{ transition: 'opacity 0.3s' }}
                      >
                        <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
                          <svg
                            className="w-10 h-10 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {videoSource === 'gdrive' && gdriveId && (
                  <div className="rounded overflow-hidden bg-black" style={{ height: '480px' }}>
                    <iframe
                      src={`https://drive.google.com/file/d/${gdriveId}/preview`}
                      width="100%"
                      height="480"
                      allow="autoplay"
                      className="rounded"
                      title="Google Drive Video"
                    />
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Google Drive videos use their built-in player. Timeline and custom controls are not available for this video source.
                      </p>
                    </div>
                  </div>
                )}

              {/* Custom Timeline - hidden for Google Drive */}
              {videoSource !== 'gdrive' && (
              <div className="mt-4">
                {/* Hover tooltip */}
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
                      {/* Arrow pointing down */}
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
                          key={comment.id}
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
                          key={comment.id}
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
                  {/* <button
                    onClick={togglePlayPause}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    Play/Pause
                  </button> */}
                  {selectedRange && (
                    <div className="text-sm text-gray-600">
                      Selected: {formatTimeRange(selectedRange.start, selectedRange.end)}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
            )}

            {/* Add comment interface */}
            {videoSource && videoSource !== 'gdrive' && (
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
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
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
            )}

            {/* Comments list */}
            {videoSource && videoSource !== 'gdrive' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Comments</h2>
              {comments.length === 0 ? (
                <p className="text-gray-500 italic">No comments yet. Add one above!</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(comment => (
                    <div
                      key={comment.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      style={{ borderLeftWidth: '4px', borderLeftColor: comment.color }}
                    >
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
                          <p className="text-gray-800">{comment.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Sidebar */}
          {videoSource && videoSource !== 'gdrive' && (
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
          )}
        </div>
      </div>
    </div>
  );
}
