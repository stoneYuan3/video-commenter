'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { VideoPlayer } from '@/components/VideoPlayer';

/**
 * Comment Interface
 * Represents both project-level and video-level comments
 */
interface Comment {
  _id: string;
  commentedTo: string;                    // Project ID or Video ID
  commentedToType: 'project' | 'video';   // Type of comment
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  content: string;                        // Comment text
  timestamp?: number;                     // Video timestamp (video comments only)
  timeRange?: { start: number; end: number }; // Time range (video comments only)
  timeString?: string;                    // Human-readable time (video comments only)
  color?: string;                         // Timeline color (video comments only)
  displayId?: string;                     // Temporary UI identifier
  createdAt: string;
  parentComment?: string;
  replies?: Comment[];
}

/**
 * Video Interface
 * Represents a single video within a project
 */
interface Video {
  _id: string;
  videoTitle: string;
  videoSource: string;                    // YouTube video ID or upload path
  thumbnail: string;
  duration?: number;
}

/**
 * Project Interface
 * Represents a project containing multiple videos
 */
interface Project {
  _id: string;
  title: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  permission?: 'invited-only' | 'anyone-view' | 'anyone-edit';
  invitedUsers?: Array<{
    email: string;
    accepted: boolean;
    userId?: {
      _id: string;
      name: string;
      email: string;
    };
    invitedAt: string;
  }>;
  videos: Video[];                        // Array of video metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * API Response Interface
 */
interface ProjectResponse {
  project: Project;
  currentVideo: Video;
  videoComments: Comment[];
  projectComments?: Comment[];            // Only present on initial load
  userPermissions: {
    canView: boolean;
    canComment: boolean;
    isOwner: boolean;
    isInvited: boolean;
  };
}

// YouTube API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

/**
 * ProjectViewPage Component
 * Main page for viewing and interacting with a project
 * Features:
 * - Video switching with lazy loading
 * - General project comments
 * - Video-specific timestamp comments
 * - Permission management
 * - User invitations
 */
export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const projectIdParam = params?.id as string;

  // Project and video state
  const [project, setProject] = useState<Project | null>(null);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Comment state
  const [projectComments, setProjectComments] = useState<Comment[]>([]);     // General project comments
  const [videoComments, setVideoComments] = useState<Comment[]>([]);         // Current video's timestamp comments
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([]); // Currently visible timestamp comments

  // Comment input state
  const [newComment, setNewComment] = useState('');
  const [newProjectComment, setNewProjectComment] = useState('');

  // Video player state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Timeline interaction state
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [hoveredComment, setHoveredComment] = useState<Comment | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Refs
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const removalTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const ytApiLoadedRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const currentVideoIdRef = useRef<string>('');
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch project data with optional video switching
   * @param videoIndex - Index of video to load (default: 0)
   */
  const fetchProjectData = async (videoIndex: number = 0) => {
    try {
      setLoading(true);
      setError('');

      // Get current user ID first
      let loggedInUserId = '';
      try {
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          loggedInUserId = userData.userId;
          setCurrentUserId(userData.userId);
        }
      } catch (e) {
        console.log('User not logged in');
      }

      // Fetch project with specified video index
      const projectRes = await fetch(`/api/videos/${projectIdParam}?videoIndex=${videoIndex}`);

      if (projectRes.status === 401 || projectRes.status === 403) {
        const errorData = await projectRes.json();
        if (errorData.accessDenied) {
          setAccessDenied(true);
          setOwnerEmail(errorData.ownerEmail || '');
          setProjectTitle(errorData.videoTitle || 'this project');
          setLoading(false);
          return;
        }
        router.push('/login');
        return;
      }

      if (!projectRes.ok) {
        throw new Error('Failed to fetch project');
      }

      const data: ProjectResponse = await projectRes.json();
      console.log('Fetched project data:', data);

      // Set project data (only on initial load)
      if (videoIndex === 0) {
        setProject(data.project);
        setProjectComments(data.projectComments || []);
      }

      // Set current video and its comments (always)
      setCurrentVideo(data.currentVideo);
      setVideoComments(data.videoComments);

      // Check if current user is the owner
      if (data.userPermissions) {
        setIsOwner(data.userPermissions.isOwner);
      } else if (loggedInUserId) {
        setIsOwner(data.project.userId?._id === loggedInUserId);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle video switching
   * Lazy loads the selected video's details and comments
   */
  const handleVideoSwitch = async (newIndex: number) => {
    if (newIndex === currentVideoIndex) return; // Already on this video

    setCurrentVideoIndex(newIndex);
    await fetchProjectData(newIndex);
  };

  // Initial load on mount
  useEffect(() => {
    if (projectIdParam) {
      fetchProjectData(0);
    }
  }, [projectIdParam]);

  // YouTube API ready handler
  const handleYouTubeApiReady = useCallback(() => {
    console.log('YouTube IFrame API is ready');
    ytApiLoadedRef.current = true;
  }, []);

  // Set up global callback for YouTube API
  useEffect(() => {
    window.onYouTubeIframeAPIReady = handleYouTubeApiReady;

    return () => {
      // Clean up interval
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }

      // Clean up player
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      playerInitializedRef.current = false;
      currentVideoIdRef.current = '';
    };
  }, [handleYouTubeApiReady]);

  // YouTube player callback
  const youtubePlayerCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node || !currentVideo || !currentVideo.videoSource) {
      return;
    }

    const videoId = currentVideo.videoSource;

    // Check if already initialized with the same video
    if (playerInitializedRef.current && currentVideoIdRef.current === videoId && playerRef.current) {
      return;
    }

    // Destroy existing player if any
    if (playerRef.current && playerRef.current.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const createPlayer = () => {
      console.log('create player - attempting to initialize');

      // Verify YT API is fully loaded
      if (!window.YT || !window.YT.Player) {
        console.error('YouTube API not available');
        return;
      }

      try {
        console.log('Creating YouTube player for video:', videoId);
        playerRef.current = new window.YT.Player(node, {
          height: '480',
          width: '100%',
          videoId: videoId,
          playerVars: {
            'playsinline': 1,
            'controls': 0,
            'modestbranding': 1,
            'rel': 0
          },
          events: {
            'onReady': onPlayerReady,
            'onError': (event: any) => {
              console.error('YouTube Player Error:', event.data);
            }
          }
        });
        console.log('YouTube player created successfully');
        playerInitializedRef.current = true;
        currentVideoIdRef.current = videoId;
      } catch (error) {
        console.error('Error creating YouTube player:', error);
      }
    };

    // Wait for YouTube API to be ready
    if (window.YT && window.YT.Player) {
      console.log('YouTube API already loaded, creating player immediately');
      createPlayer();
    } else {
      console.log('Waiting for YouTube API to load...');
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds total
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.YT && window.YT.Player) {
          console.log('YouTube API loaded after', attempts * 100, 'ms');
          clearInterval(checkInterval);
          createPlayer();
        } else if (attempts >= maxAttempts) {
          console.error('YouTube API failed to load after 10 seconds');
          clearInterval(checkInterval);
        }
      }, 100);
    }
  }, [currentVideo]);

  const onPlayerReady = () => {
    console.log('YouTube player ready');
    const dur = playerRef.current.getDuration();
    setDuration(dur);

    // Clear any existing interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }

    // Create new interval and store reference
    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
      }
    }, 100);
  };

  // Show timestamp comments when time matches
  useEffect(() => {
    const matchingComments = videoComments.filter(comment => {
      if (comment.timestamp !== undefined) {
        return Math.abs(comment.timestamp - currentTime) < 1;
      } else if (comment.timeRange) {
        return currentTime >= comment.timeRange.start && currentTime <= comment.timeRange.end;
      }
      return false;
    });

    removalTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    removalTimeoutsRef.current.clear();

    const prevDisplayedIds = new Set(displayedComments.map(c => c._id));
    const newlyActive = matchingComments.filter(c => !prevDisplayedIds.has(c._id));

    if (newlyActive.length > 0 && commentsContainerRef.current) {
      const firstActiveCommentId = newlyActive[0]._id;
      const commentElement = commentRefs.current.get(firstActiveCommentId);
      if (commentElement) {
        setTimeout(() => {
          commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }

    setDisplayedComments(matchingComments.map(comment => ({
      ...comment,
      displayId: `${comment._id}-${Date.now()}`
    })));
  }, [currentTime, videoComments]);

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

  /**
   * Add a video-specific timestamp comment
   */
  const addVideoComment = async () => {
    if (!newComment.trim() || !currentVideo || !project) return;

    const commentData = {
      commentedTo: currentVideo._id,
      commentedToType: 'video' as const,
      content: newComment,
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
      setVideoComments(prev => [...prev, data.comment].sort((a, b) => {
        const aTime = a.timestamp ?? a.timeRange?.start ?? 0;
        const bTime = b.timestamp ?? b.timeRange?.start ?? 0;
        return aTime - bTime;
      }));
      setNewComment('');
      setSelectedRange(null);
    } catch (err: any) {
      console.error('Add video comment error:', err);
      alert('Failed to add comment');
    }
  };

  /**
   * Add a general project comment
   */
  const addProjectComment = async () => {
    if (!newProjectComment.trim() || !project) return;

    const commentData = {
      commentedTo: project._id,
      commentedToType: 'project' as const,
      content: newProjectComment,
    };

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });

      if (!res.ok) {
        throw new Error('Failed to add project comment');
      }

      const data = await res.json();
      setProjectComments(prev => [data.comment, ...prev]); // Add to top (newest first)
      setNewProjectComment('');
    } catch (err: any) {
      console.error('Add project comment error:', err);
      alert('Failed to add project comment');
    }
  };

  const addReply = async (parentCommentId: string, commentType: 'project' | 'video') => {
    if (!replyText.trim() || !currentVideo || !project) return;

    const replyData = {
      commentedTo: commentType === 'project' ? project._id : currentVideo._id,
      commentedToType: commentType,
      content: replyText,
      parentComment: parentCommentId,
    };

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyData),
      });

      if (!res.ok) {
        throw new Error('Failed to add reply');
      }

      const data = await res.json();

      // Update appropriate comment list
      if (commentType === 'project') {
        setProjectComments(prev => prev.map(comment => {
          if (comment._id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), data.comment]
            };
          }
          return comment;
        }));
      } else {
        setVideoComments(prev => prev.map(comment => {
          if (comment._id === parentCommentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), data.comment]
            };
          }
          return comment;
        }));
      }

      setReplyText('');
      setReplyingToCommentId(null);
    } catch (err: any) {
      console.error('Add reply error:', err);
      alert('Failed to add reply');
    }
  };

  const startReply = (commentId: string) => {
    setReplyingToCommentId(commentId);
    setReplyText('');
  };

  const cancelReply = () => {
    setReplyingToCommentId(null);
    setReplyText('');
  };

  const startEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.content);
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
        body: JSON.stringify({ content: editText }),
      });

      if (!res.ok) {
        throw new Error('Failed to update comment');
      }

      const data = await res.json();

      // Update in both lists (in case it's in either)
      setProjectComments(prev => prev.map(c => c._id === commentId ? data.comment : c));
      setVideoComments(prev => prev.map(c => c._id === commentId ? data.comment : c));

      setEditingCommentId(null);
      setEditText('');
    } catch (err: any) {
      console.error('Edit comment error:', err);
      alert('Failed to edit comment');
    }
  };

  const deleteComment = async (commentId: string, commentType: 'project' | 'video') => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete comment');
      }

      // Update appropriate comment list
      if (commentType === 'project') {
        setProjectComments(prev => prev.map(comment => {
          if (comment._id === commentId) {
            return null;
          }
          if (comment.replies && comment.replies.length > 0) {
            const replyIndex = comment.replies.findIndex(r => r._id === commentId);
            if (replyIndex !== -1) {
              return {
                ...comment,
                replies: comment.replies.filter(r => r._id !== commentId)
              };
            }
          }
          return comment;
        }).filter(c => c !== null) as Comment[]);
      } else {
        setVideoComments(prev => prev.map(comment => {
          if (comment._id === commentId) {
            return null;
          }
          if (comment.replies && comment.replies.length > 0) {
            const replyIndex = comment.replies.findIndex(r => r._id === commentId);
            if (replyIndex !== -1) {
              return {
                ...comment,
                replies: comment.replies.filter(r => r._id !== commentId)
              };
            }
          }
          return comment;
        }).filter(c => c !== null) as Comment[]);
      }
    } catch (err: any) {
      console.error('Delete comment error:', err);
      alert('Failed to delete comment');
    }
  };

  const updatePermission = async (permission: string) => {
    if (!project) return;

    try {
      const res = await fetch(`/api/videos/${project._id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission }),
      });

      if (!res.ok) {
        throw new Error('Failed to update permission');
      }

      const data = await res.json();
      setProject(data.video);
      setShowPermissionModal(false);
    } catch (err: any) {
      console.error('Update permission error:', err);
      alert('Failed to update permission: ' + err.message);
    }
  };

  const inviteUser = async () => {
    if (!project || !inviteEmail.trim()) return;

    try {
      const res = await fetch(`/api/videos/${project._id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite user');
      }

      const data = await res.json();
      setProject(data.video);
      setInviteEmail('');
      setShowInviteModal(false);
      alert(`Successfully invited ${inviteEmail}`);
    } catch (err: any) {
      console.error('Invite user error:', err);
      alert(err.message);
    }
  };

  const removeInvitedUser = async (email: string) => {
    if (!project) return;
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const res = await fetch(`/api/videos/${project._id}/invite?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to remove user');
      }

      const data = await res.json();
      setProject(data.video);
    } catch (err: any) {
      console.error('Remove user error:', err);
      alert('Failed to remove user: ' + err.message);
    }
  };

  const jumpToTime = (timestamp: number, shouldPause: boolean = false) => {
    if (!currentVideo) return;

    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      if (shouldPause) {
        playerRef.current.pauseVideo();
      }
    } else if (videoRef.current) {
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
      addVideoComment();
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
      if (videoRef.current && !hasDragged) {
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
  }, [currentVideo]);

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
    if (!currentVideo) return;

    if (playerRef.current) {
      const state = playerRef.current.getPlayerState();
      if (state === 1) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } else if (videoRef.current) {
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
        <div className="text-gray-600">Loading project...</div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You do not have permission to view <strong>{projectTitle}</strong>.
          </p>
          {ownerEmail && (
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                If you believe you should have access, please contact the project owner:
              </p>
              <a
                href={`mailto:${ownerEmail}?subject=Request access to "${projectTitle}"`}
                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                📧 Contact Owner
              </a>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project || !currentVideo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
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
    <>
      {/* Load YouTube IFrame API */}
      <Script
        src="https://www.youtube.com/iframe_api"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('YouTube API script loaded');
        }}
        onError={(e) => {
          console.error('Failed to load YouTube API script:', e);
        }}
      />

      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-[1440px] p-[64px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-[25px]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-800">{project.title}</h1>
              {isOwner && (
                <>
                  <button
                    onClick={() => setShowPermissionModal(true)}
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                    title="Click to adjust permissions"
                  >
                    {project.permission === 'invited-only' && '🔒 Invited Only'}
                    {project.permission === 'anyone-view' && '👁️ Anyone View'}
                    {project.permission === 'anyone-edit' && '✏️ Anyone Edit'}
                    {!project.permission && '🔒 Invited Only'}
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="flex flex-col gap-[25px]">

          {/* Video Thumbnails Bar */}
          <div className='flex gap-[20px] w-full h-full bg-[#E8E8E8] px-[35px] py-[15px]'>
            {project.videos && project.videos.map((video, index) => (
              <div
                key={video._id}
                onClick={() => handleVideoSwitch(index)}
                className={`w-[125px] h-[70px] rounded-lg shadow-lg cursor-pointer transition-all ${
                  index === currentVideoIndex
                    ? 'ring-4 ring-blue-500 scale-105'
                    : 'hover:scale-105'
                }`}
              >
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt={video.videoTitle}
                    className="w-full h-full rounded object-cover"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-6">

            {/* Main content */}
            <div className="flex-1">
              {/* Video embed */}
              <div className='flex flex-col gap-[32px]'>
                <div className="mb-6 w-full max-w-[1180px]">
                  <div className='relative'>
                    <div className='z-[1] relative'>
                      <VideoPlayer
                        key={currentVideo.videoSource}
                        videoSource="youtube"
                        videoId={currentVideo.videoSource}
                        youtubePlayerCallback={youtubePlayerCallback}
                        videoRef={videoRef}
                        isPlaying={isPlaying}
                        togglePlayPause={togglePlayPause}
                      />
                    </div>
                  </div>

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
                          <div className="text-white/90">{hoveredComment.content}</div>
                          <div
                            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
                            style={{ borderTopColor: hoveredComment.color }}
                          />
                        </div>
                      </div>
                    )}

                    <div className='mb-1 text-sm text-gray-600'>
                      <p>Click on the timeline to mark a timestamp, drag on the timeline to mark a time range.</p>
                    </div>

                    <div
                      ref={timelineRef}
                      className="relative h-12 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
                      onClick={handleTimelineClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      style={{ userSelect: 'none' }}
                    >
                      {/* Comment labels on timeline */}
                      {videoComments.map(comment => {
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

                {/* General Comments Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800">General Comments</h2>

                  {/* General Comments List */}
                  <div className="mb-4 max-h-[400px] overflow-y-auto pr-2">
                    {projectComments.length === 0 ? (
                      <p className="text-gray-500 italic">No general comments yet. Add one below!</p>
                    ) : (
                      <div className="space-y-3">
                        {projectComments.map(comment => {
                          const isEditing = editingCommentId === comment._id;

                          return (
                            <div
                              key={comment._id}
                              className="border-l-[5px] p-3 bg-gray-50 hover:bg-gray-100 transition-all"
                              style={{ borderLeftColor: '#3b82f6' }}
                            >
                              {isEditing ? (
                                <div>
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-2 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => saveEdit(comment._id)}
                                      className="px-2 py-1 text-white rounded text-xs"
                                      style={{ backgroundColor: '#00875F' }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-700">{comment.userId.name}</span>
                                      <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      {currentUserId && (
                                        <button
                                          onClick={() => startReply(comment._id)}
                                          className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                          Reply
                                        </button>
                                      )}
                                      {comment.userId._id === currentUserId && (
                                        <>
                                          <button
                                            onClick={() => startEdit(comment)}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => deleteComment(comment._id, 'project')}
                                            className="text-xs text-red-600 hover:text-red-700"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-600">{comment.content}</p>
                                </div>
                              )}

                              {/* Reply input form */}
                              {replyingToCommentId === comment._id && (
                                <div className="mt-3 p-3 bg-white rounded-lg border">
                                  <div className="flex gap-2 mb-2">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      onKeyPress={(e) => e.key === 'Enter' && addReply(comment._id, 'project')}
                                      placeholder="Write a reply..."
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                                    />
                                    <button
                                      onClick={() => addReply(comment._id, 'project')}
                                      className="px-3 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                                      style={{ backgroundColor: '#00875F' }}
                                    >
                                      Reply
                                    </button>
                                    <button
                                      onClick={cancelReply}
                                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Display replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="mt-3 ml-4 space-y-2">
                                  {comment.replies.map((reply) => (
                                    <div
                                      key={reply._id}
                                      className="p-3 bg-white rounded-lg border-l-2"
                                      style={{ borderLeftColor: '#3b82f6' }}
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <p className="text-sm text-gray-600">
                                          <span className="font-medium">{reply.userId.name}</span>
                                        </p>
                                        {reply.userId._id === currentUserId && (
                                          <button
                                            onClick={() => deleteComment(reply._id, 'project')}
                                            className="text-xs text-red-600 hover:text-red-700"
                                          >
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-700 mb-1">{reply.content}</p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(reply.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add General Comment UI */}
                  {currentUserId ? (
                    <div className="border-t pt-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProjectComment}
                          onChange={(e) => setNewProjectComment(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addProjectComment()}
                          placeholder="Add a general comment about this project..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                        />
                        <button
                          onClick={addProjectComment}
                          className="px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                          style={{ backgroundColor: '#00875F' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006644')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t pt-4 text-center">
                      <p className="text-gray-600 text-sm">
                        <a href="/login" className="text-blue-500 hover:underline">Log in</a> or <a href="/signup" className="text-blue-500 hover:underline">Sign up</a> to add comments
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Sidebar */}
            <div className="w-96">
              {/* Timestamp Comments Section */}
              <div
                className="bg-white rounded-lg shadow-lg p-6 flex flex-col"
                style={{ height: 'fit-content' }}
              >
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Timestamp Comments</h2>

                {/* Comments List with Scroll */}
                <div
                  ref={commentsContainerRef}
                  className="flex-1 overflow-y-auto mb-4 pr-2"
                  style={{
                    maxHeight: 'calc(100vh - 400px)',
                    minHeight: '400px'
                  }}
                >
                  {videoComments.length === 0 ? (
                    <p className="text-gray-500 italic">No timestamp comments yet. Add one below!</p>
                  ) : (
                    <div className="space-y-3">
                      {videoComments.map(comment => {
                        const isActive = displayedComments.some(dc => dc._id === comment._id);
                        const isEditing = editingCommentId === comment._id;

                        return (
                          <div
                            key={comment._id}
                            ref={(el) => {
                              if (el) commentRefs.current.set(comment._id, el);
                              else commentRefs.current.delete(comment._id);
                            }}
                            className={`border-l-[5px] p-3 transition-all duration-200 cursor-pointer ${
                              isActive ? 'shadow-md bg-[#fef3c7]' : 'bg-[#ffffff]'
                            } hover:shadow-lg hover:bg-[#fef3c7]`}
                            style={{
                              borderLeftColor: comment.color,
                            }}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                              const targetTime = comment.timestamp ?? comment.timeRange?.start ?? 0;
                              jumpToTime(targetTime, false);
                              const commentElement = commentRefs.current.get(comment._id);
                              if (commentElement) {
                                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                          >
                            {isEditing ? (
                              <div>
                                <input
                                  type="text"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-2 text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveEdit(comment._id)}
                                    className="px-2 py-1 text-white rounded text-xs"
                                    style={{ backgroundColor: '#00875F' }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start justify-between mb-2">
                                  <button
                                    onClick={() => jumpToTime(comment.timestamp ?? comment.timeRange?.start ?? 0, false)}
                                    className={`font-mono text-xs font-semibold hover:underline flex items-center gap-1 ${
                                      isActive ? 'text-blue-600' : 'text-gray-600'
                                    }`}
                                  >
                                    {comment.timeRange && (
                                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                                        isActive ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-300 text-gray-700'
                                      }`}>
                                        RANGE
                                      </span>
                                    )}
                                    {comment.timeString}
                                  </button>
                                  <div className="flex gap-1">
                                    {currentUserId && (
                                      <button
                                        onClick={() => startReply(comment._id)}
                                        className={`text-xs ${
                                          isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                      >
                                        Reply
                                      </button>
                                    )}
                                    {comment.userId._id === currentUserId && (
                                      <>
                                        <button
                                          onClick={() => startEdit(comment)}
                                          className={`text-xs ${
                                            isActive ? 'text-blue-600 hover:text-blue-700' : 'text-gray-500 hover:text-gray-700'
                                          }`}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => deleteComment(comment._id, 'video')}
                                          className="text-xs text-red-600 hover:text-red-700"
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <p className={`text-sm mb-1 ${
                                  isActive ? 'text-gray-900 font-medium' : 'text-gray-600'
                                }`}>{comment.content}</p>
                                <p className={`text-xs ${
                                  isActive ? 'text-gray-600' : 'text-gray-500'
                                }`}>
                                  By {comment.userId.name} • {new Date(comment.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            )}

                            {/* Reply input form */}
                            {replyingToCommentId === comment._id && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                                <div className="flex gap-2 mb-2">
                                  <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addReply(comment._id, 'video')}
                                    placeholder="Write a reply..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                                  />
                                  <button
                                    onClick={() => addReply(comment._id, 'video')}
                                    className="px-3 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                                    style={{ backgroundColor: '#00875F' }}
                                  >
                                    Reply
                                  </button>
                                  <button
                                    onClick={cancelReply}
                                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Display replies */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="mt-3 ml-4 space-y-2">
                                {comment.replies.map((reply) => (
                                  <div
                                    key={reply._id}
                                    className="p-3 bg-gray-50 rounded-lg border-l-2"
                                    style={{ borderLeftColor: comment.color }}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <p className="text-sm text-gray-600">
                                        <span className="font-medium">{reply.userId.name}</span>
                                      </p>
                                      {reply.userId._id === currentUserId && (
                                        <button
                                          onClick={() => deleteComment(reply._id, 'video')}
                                          className="text-xs text-red-600 hover:text-red-700"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-700 mb-1">{reply.content}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(reply.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Timestamp Comment UI */}
                {currentUserId ? (
                  <div className="border-t pt-4">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addVideoComment()}
                        placeholder="Add a timestamp comment..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 text-sm"
                      />
                      <button
                        onClick={addVideoComment}
                        className="px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                        style={{ backgroundColor: '#00875F' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006644')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00875F')}
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedRange
                        ? `Range: ${formatTimeRange(selectedRange.start, selectedRange.end)}`
                        : `At: ${formatTime(currentTime)}`
                      }
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4 text-center">
                    <p className="text-gray-600 text-sm">
                      <a href="/login" className="text-blue-500 hover:underline">Log in</a> or <a href="/signup" className="text-blue-500 hover:underline">Sign up</a> to add comments
                    </p>
                  </div>
                )}
              </div>

              {/* Invited Commenters */}
              {currentUserId && (
              <div className={`bg-white rounded-lg shadow-lg p-6 mt-6 ${
                project.permission === 'anyone-edit' ? 'opacity-50 pointer-events-none' : ''
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Invited Commenters</h2>
                  {isOwner && project.permission !== 'anyone-edit' && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Invite user"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {project.invitedUsers && project.invitedUsers.length > 0 ? (
                    project.invitedUsers.map((invited) => (
                      <div key={invited.email} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex-1">
                          {invited.accepted && invited.userId ? (
                            <>
                              <p className="text-sm font-medium text-gray-800">{invited.userId.name}</p>
                              <p className="text-xs text-gray-500">{invited.email}</p>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{invited.email}</p>
                              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                                Pending
                              </span>
                            </div>
                          )}
                        </div>
                        {isOwner && (
                          <button
                            onClick={() => removeInvitedUser(invited.email)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove user"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">No invited users yet</p>
                  )}
                </div>
                {project.permission === 'anyone-edit' && (
                  <p className="text-xs text-gray-500 mt-4 italic">
                    Invite list is disabled when permission is set to "Anyone Can Edit"
                  </p>
                )}
              </div>
              )}
            </div>

          </div>

        </div>

        {/* Permission Modal */}
        {showPermissionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPermissionModal(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4 text-gray-800">Adjust Permissions</h2>
              <p className="text-sm text-gray-600 mb-4">Project: {project.title}</p>
              <div className="space-y-3">
                <button
                  onClick={() => updatePermission('invited-only')}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    (project.permission || 'invited-only') === 'invited-only'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-800">🔒 Invited Only</div>
                  <div className="text-sm text-gray-600">Only invited users can view and comment</div>
                </button>
                <button
                  onClick={() => updatePermission('anyone-view')}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    (project.permission || 'invited-only') === 'anyone-view'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-800">👁️ Anyone Can View</div>
                  <div className="text-sm text-gray-600">Anyone with link can view, invited users can comment</div>
                </button>
                <button
                  onClick={() => updatePermission('anyone-edit')}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    (project.permission || 'invited-only') === 'anyone-edit'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-800">✏️ Anyone Can Edit</div>
                  <div className="text-sm text-gray-600">Anyone with link can view and comment (requires account)</div>
                </button>
              </div>
              <button
                onClick={() => {
                  const projectUrl = window.location.href;
                  navigator.clipboard.writeText(projectUrl);
                  alert('Project link copied to clipboard!');
                }}
                className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                📋 Copy Project Link
              </button>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="mt-2 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Invite User Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4 text-gray-800">Invite User</h2>
              <p className="text-sm text-gray-600 mb-4">Project: {project.title}</p>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && inviteUser()}
                placeholder="Enter email address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-4"
              />
              <div className="flex gap-2 mb-3">
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
              <button
                onClick={() => {
                  const projectUrl = window.location.href;
                  navigator.clipboard.writeText(projectUrl);
                  alert('Project link copied to clipboard!');
                }}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                📋 Copy Project Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
