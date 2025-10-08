'use client';

import { useState, useRef, useEffect } from 'react';

interface Comment {
  id: string;
  timestamp?: number;
  timeRange?: { start: number; end: number };
  text: string;
  timeString: string;
  displayId?: string;
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

  const playerRef = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '480',
        width: '100%',
        videoId: 'XuCiqeKXqu8',
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
  }, []);

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

    if (matchingComments.length > 0) {
      const newDisplayedComments = matchingComments.map(comment => ({
        ...comment,
        displayId: `${comment.id}-${Date.now()}`
      }));

      setDisplayedComments(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const toAdd = newDisplayedComments.filter(c => !existingIds.has(c.id));
        return [...prev, ...toAdd];
      });

      newDisplayedComments.forEach(comment => {
        setTimeout(() => {
          setDisplayedComments(prev =>
            prev.filter(c => c.displayId !== comment.displayId)
          );
        }, 4000);
      });
    }
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

  const addComment = () => {
    if (newComment.trim()) {
      const comment: Comment = selectedRange
        ? {
            id: Date.now().toString(),
            timeRange: selectedRange,
            text: newComment,
            timeString: formatTimeRange(selectedRange.start, selectedRange.end)
          }
        : {
            id: Date.now().toString(),
            timestamp: currentTime,
            text: newComment,
            timeString: formatTime(currentTime)
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
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      if (shouldPause) {
        playerRef.current.pauseVideo();
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
    if (playerRef.current) {
      const state = playerRef.current.getPlayerState();
      if (state === 1) { // Playing
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
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
            {/* Video embed */}
            <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
              <div
                id="youtube-player"
                ref={playerDivRef}
                className="rounded"
              />

              {/* Custom Timeline */}
              <div className="mt-4">
                <div
                  ref={timelineRef}
                  className="relative h-12 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
                  onClick={handleTimelineClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  style={{ userSelect: 'none' }}
                >
                  {/* Progress bar */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-400 rounded-lg pointer-events-none"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />

                  {/* Selected range highlight */}
                  {selectedRange && (
                    <div
                      className="absolute top-0 h-full bg-yellow-400 opacity-60 pointer-events-none border-2 border-yellow-600"
                      style={getSelectionStyle()}
                    />
                  )}

                  {/* Current time indicator */}
                  <div
                    className="absolute top-0 w-1 h-full bg-red-500 pointer-events-none"
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
                  <button
                    onClick={togglePlayPause}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    Play/Pause
                  </button>
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

            {/* Comments list */}
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
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <button
                            onClick={() => jumpToTime(comment.timestamp ?? comment.timeRange?.start ?? 0, true)}
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
