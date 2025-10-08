'use client';

import { useState, useRef, useEffect } from 'react';

interface Comment {
  id: string;
  timestamp: number;
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
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]);
  const playerRef = useRef<any>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    // Load the IFrame Player API code asynchronously
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Create YouTube player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '480',
        width: '100%',
        videoId: 'XuCiqeKXqu8',
        playerVars: {
          'playsinline': 1
        },
        events: {
          'onReady': onPlayerReady,
        }
      });
    };
  }, []);

  const onPlayerReady = () => {
    // Start polling for current time
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = Math.floor(playerRef.current.getCurrentTime());
        setCurrentTime(time);
      }
    }, 100); // Poll every 100ms for smoother updates

    return () => clearInterval(interval);
  };

  // Show comments when timestamp matches
  useEffect(() => {
    const matchingComments = comments.filter(
      comment => Math.abs(comment.timestamp - currentTime) < 1
    );

    if (matchingComments.length > 0) {
      // Add display IDs and timestamps to track when they should disappear
      const newDisplayedComments = matchingComments.map(comment => ({
        ...comment,
        displayId: `${comment.id}-${Date.now()}`
      }));

      setDisplayedComments(prev => {
        // Add new comments if they're not already displayed
        const existingIds = new Set(prev.map(c => c.id));
        const toAdd = newDisplayedComments.filter(c => !existingIds.has(c.id));
        return [...prev, ...toAdd];
      });

      // Remove comments after 4 seconds
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
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addComment = () => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        timestamp: currentTime,
        text: newComment,
        timeString: formatTime(currentTime)
      };
      setComments(prev => [...prev, comment].sort((a, b) => a.timestamp - b.timestamp));
      setNewComment('');
    }
  };

  const jumpToTime = (timestamp: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
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
              <div className="mt-2 text-sm text-gray-600">
                Current Time: {formatTime(currentTime)}
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
                Comment will be added at: {formatTime(currentTime)}
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
                            onClick={() => jumpToTime(comment.timestamp)}
                            className="text-blue-500 hover:text-blue-700 font-mono text-sm font-semibold mb-2 hover:underline"
                          >
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
                        className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fade-in"
                      >
                        <div className="text-blue-600 font-mono text-sm font-semibold mb-2">
                          {comment.timeString}
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
