import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import initializeModels from '@/lib/initModels';
import Comment from '@/models/Comment';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// GET comments for a specific video
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    await connectDB();
    initializeModels();

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
    const isInvited = user && video.invitedUsers.some((invited: any) =>
      invited.email === user.email && invited.accepted
    );

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

    const comments = await Comment.find({ videoId, parentCommentId: { $exists: false } })
      .populate('userId', 'name email username')
      .populate({
        path: 'replies',
        populate: {
          path: 'userId',
          select: 'name email username'
        }
      })
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
    initializeModels();

    const { videoId, text, timestamp, timeRange, timeString, color, parentCommentId } = await req.json();

    // Validation
    if (!videoId || !text) {
      return NextResponse.json(
        { error: 'Video ID and text are required' },
        { status: 400 }
      );
    }

    // For replies, we don't need timeString and color
    if (!parentCommentId && (!timeString || !color)) {
      return NextResponse.json(
        { error: 'Time string and color are required for top-level comments' },
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
      parentCommentId,
    });

    // If this is a reply, add it to the parent comment's replies array
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(
        parentCommentId,
        { $push: { replies: comment._id } }
      );
    }

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
