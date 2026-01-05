import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/videos
 * Retrieves all projects owned by the currently logged-in user
 * Returns: Array of projects sorted by creation date (newest first)
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Find all projects owned by this user
    const projects = await Project.find({ userId: user.userId })
      .populate({
        path: 'videos',
        select: 'videoTitle thumbnail', // Only fetch title and thumbnail for list view
      })
      .sort({ createdAt: -1 }); // Newest first

    return NextResponse.json({ videos: projects }, { status: 200 });
  } catch (error: any) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/videos
 * Creates a new project with multiple videos
 * Body: { title: string, videos: Array<{ url: string }> }
 * Process:
 * 1. Validate input
 * 2. Extract YouTube video IDs from URLs
 * 3. Fetch video titles from YouTube (or use defaults)
 * 4. Create Video documents
 * 5. Create Project document with Video references
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { title, videos } = body;

    // Validate project title
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Project title is required' }, { status: 400 });
    }

    // Validate videos array
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: 'At least one video is required' }, { status: 400 });
    }

    // Process each video and create Video documents
    const createdVideos = [];
    for (const videoData of videos) {
      const { videoSource, videoId, thumbnail, videoTitle, duration } = videoData;

      // Validate required fields
      if (!videoSource) {
        return NextResponse.json(
          { error: 'Video source is required for all videos' },
          { status: 400 }
        );
      }

      // Create Video document
      const video = await Video.create({
        videoTitle: videoTitle || 'Untitled Video', // Use provided title or default
        videoSource: videoSource, // YouTube URL or video ID
        thumbnail: thumbnail || '', // YouTube thumbnail URL
        duration: duration || 0,
      });

      createdVideos.push(video._id);
    }

    // Create Project document with references to created videos
    const project = await Project.create({
      userId: user.userId,
      title: title.trim(),
      videos: createdVideos, // Array of Video._id references
      permission: 'invited-only', // Default permission
      invitedUsers: [],
      lastOpenedBy: new Map(),
    });

    // Populate the project with video details for response
    const populatedProject = await Project.findById(project._id)
      .populate('userId', 'username name email')
      .populate('videos', 'videoTitle videoSource thumbnail duration');

    return NextResponse.json(
      {
        message: 'Project created successfully',
        video: populatedProject // Keep 'video' key for backward compatibility with frontend
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
