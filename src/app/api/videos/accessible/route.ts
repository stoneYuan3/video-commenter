import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// GET all videos accessible to the current user (owned + shared)
export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [${requestId}] GET /api/videos/accessible - Request started`);

  try {
    const user = getUserFromRequest(req);

    if (!user) {
      console.log(`[${timestamp}] [${requestId}] Authentication failed - No user found`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${timestamp}] [${requestId}] User authenticated:`, {
      userId: user.userId,
      email: user.email,
    });

    console.log(`[${timestamp}] [${requestId}] Attempting MongoDB connection...`);
    const dbStartTime = Date.now();

    let dbConnection;
    try {
      dbConnection = await connectDB();
      const dbConnectionTime = Date.now() - dbStartTime;
      console.log(`[${timestamp}] [${requestId}] MongoDB connected successfully in ${dbConnectionTime}ms`, {
        readyState: dbConnection.connection.readyState,
        host: dbConnection.connection.host,
        name: dbConnection.connection.name,
      });
    } catch (dbError: any) {
      console.error(`[${timestamp}] [${requestId}] MongoDB connection failed:`, {
        errorName: dbError.name,
        errorMessage: dbError.message,
        errorStack: dbError.stack,
      });
      throw dbError;
    }

    console.log(`[${timestamp}] [${requestId}] Querying videos for user...`);
    const queryStartTime = Date.now();

    // Find videos where:
    // 1. User is the owner, OR
    // 2. User's email is in the invitedUsers list AND accepted is true
    const videos = await Video.find({
      $or: [
        { userId: user.userId },
        {
          invitedUsers: {
            $elemMatch: {
              email: user.email,
              accepted: true
            }
          }
        }
      ]
    })
    .populate('userId', 'username name email')
    .populate('invitedUsers.userId', 'name email');

    const queryTime = Date.now() - queryStartTime;
    console.log(`[${timestamp}] [${requestId}] Query completed in ${queryTime}ms, found ${videos.length} videos`);

    // Sort videos by last opened time for this user (most recent first)
    const sortedVideos = videos.map(video => {
      const lastOpened = video.lastOpenedBy?.get(user.userId);
      return {
        ...video.toObject(),
        lastOpenedAt: lastOpened || video.createdAt, // Fallback to createdAt if never opened
      };
    }).sort((a, b) => {
      const timeA = new Date(a.lastOpenedAt).getTime();
      const timeB = new Date(b.lastOpenedAt).getTime();
      return timeB - timeA; // Most recent first
    });

    const totalTime = Date.now() - dbStartTime;
    console.log(`[${timestamp}] [${requestId}] Request completed successfully in ${totalTime}ms`, {
      videoCount: sortedVideos.length,
    });

    return NextResponse.json({ videos: sortedVideos }, { status: 200 });
  } catch (error: any) {
    console.error(`[${timestamp}] [${requestId}] GET /api/videos/accessible - ERROR:`, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code,
      mongooseError: error.constructor.name,
    });

    return NextResponse.json(
      {
        error: error.message || 'Something went wrong',
        errorType: error.name,
        requestId,
      },
      { status: 500 }
    );
  }
}
