import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Comment from '@/models/Comment';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// GET comments for a specific video
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    await connectDB();

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Check video permissions
    const video = await Video.findById(videoId);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if user has permission to view comments
    const isOwner = user && video.userId.toString() === user.userId;
    const isInvited = user && video.invitedUsers.some((id: any) => id.toString() === user.userId);

    if (video.permission === 'invited-only') {
      // For invited-only, must be logged in and either owner or invited
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!isOwner && !isInvited) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    // For anyone-view and anyone-edit, allow viewing comments without login

    const comments = await Comment.find({ videoId })
      .populate('userId', 'name email username')
      .sort({ timestamp: 1, 'timeRange.start': 1 });

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error: any) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// POST create a new comment
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { videoId, text, timestamp, timeRange, timeString, color } = await req.json();

    // Validation
    if (!videoId || !text || !timeString || !color) {
      return NextResponse.json(
        { error: 'Video ID, text, time string, and color are required' },
        { status: 400 }
      );
    }

    const comment = await Comment.create({
      videoId,
      userId: user.userId,
      text,
      timestamp,
      timeRange,
      timeString,
      color,
    });

    // Populate user info for response
    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name email');

    return NextResponse.json(
      { message: 'Comment created successfully', comment: populatedComment },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
