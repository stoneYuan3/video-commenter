import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { executeDbOperation } from '@/lib/dbUtils';

// Accept invitation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get current user if logged in
    const currentUser = getUserFromRequest(req);

    const result = await executeDbOperation(
      async () => {
        const video = await Video.findById(id);

        if (!video) {
          throw new Error('Video not found');
        }

        // Find the invitation
        const invitationIndex = video.invitedUsers.findIndex(
          (invited: any) => invited.email === email
        );

        if (invitationIndex === -1) {
          // Return specific error response for deleted/not-found invitations
          const populatedVideo = await video.populate('userId', 'email');
          return {
            notFound: true,
            videoTitle: video.title,
            ownerEmail: (populatedVideo.userId as any)?.email
          };
        }

        const invitation = video.invitedUsers[invitationIndex];

        if (invitation.accepted) {
          // Already accepted, just return success
          return { video, alreadyAccepted: true, hasAccount: !!invitation.userId };
        }

        // Check if user has an account
        const user = await User.findOne({ email });

        if (!user) {
          // User doesn't have account yet, mark as pending signup
          return { video, hasAccount: false, alreadyAccepted: false };
        }

        // User has account, mark as accepted
        video.invitedUsers[invitationIndex].accepted = true;
        video.invitedUsers[invitationIndex].userId = user._id;
        await video.save();

        return { video, hasAccount: true, alreadyAccepted: false };
      },
      'Failed to accept invitation'
    );

    const { video, hasAccount, alreadyAccepted, notFound, videoTitle, ownerEmail } = result as any;

    // Handle invitation not found case
    if (notFound) {
      return NextResponse.json({
        error: 'Invitation not found. Please contact the video owner.',
        invitationNotFound: true,
        videoTitle,
        ownerEmail
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      hasAccount,
      alreadyAccepted,
      videoId: video._id,
      videoTitle: video.title,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
