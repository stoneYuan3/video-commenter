import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import initializeModels from '@/lib/initModels';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/videos/accessible
 * Retrieves all projects accessible to the current user
 * Includes:
 * - Projects owned by the user
 * - Projects where user is invited and has accepted the invitation
 *
 * Returns: Array of projects sorted by last opened time (most recent first)
 */
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

    // Initialize all models to prevent MissingSchemaError during populate()
    // This is critical for serverless environments after cold starts
    console.log(`[${timestamp}] [${requestId}] Initializing models...`);
    const { Project, User } = initializeModels();
    console.log(`[${timestamp}] [${requestId}] Models initialized successfully`);

    console.log(`[${timestamp}] [${requestId}] Querying projects for user...`);
    const queryStartTime = Date.now();

    // Find projects where:
    // 1. User is the owner, OR
    // 2. User's email is in the invitedUsers list AND accepted is true
    const projects = await Project.find({
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
    .populate('invitedUsers.userId', 'name email')
    .populate({
      path: 'videos',
      select: 'videoTitle thumbnail _id', // Only fetch metadata for dashboard display
    });

    const queryTime = Date.now() - queryStartTime;
    console.log(`[${timestamp}] [${requestId}] Query completed in ${queryTime}ms, found ${projects.length} projects`);

    // Sort projects by last opened time for this user (most recent first)
    const sortedProjects = projects.map(project => {
      const lastOpened = project.lastOpenedBy?.get(user.userId);
      return {
        ...project.toObject(),
        lastOpenedAt: lastOpened || project.createdAt, // Fallback to createdAt if never opened
      };
    }).sort((a, b) => {
      const timeA = new Date(a.lastOpenedAt).getTime();
      const timeB = new Date(b.lastOpenedAt).getTime();
      return timeB - timeA; // Most recent first
    });

    const totalTime = Date.now() - dbStartTime;
    console.log(`[${timestamp}] [${requestId}] Request completed successfully in ${totalTime}ms`, {
      projectCount: sortedProjects.length,
    });

    return NextResponse.json({ videos: sortedProjects }, { status: 200 }); // Keep 'videos' key for backward compatibility with frontend
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
