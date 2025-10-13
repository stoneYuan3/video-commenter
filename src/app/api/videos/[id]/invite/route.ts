import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';
import { executeDbOperation } from '@/lib/dbUtils';

// Add invited user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const result = await executeDbOperation(
      async () => {
        const video = await Video.findById(id);

        if (!video) {
          throw new Error('Video not found');
        }

        // Check if user is owner or invited user
        const isOwner = video.userId.toString() === user.userId;
        const isInvited = video.invitedUsers.includes(user.email);

        if (!isOwner && !isInvited) {
          throw new Error('You do not have permission to invite users');
        }

        // Find user to invite
        const userToInvite = await User.findOne({ email });

        if (!userToInvite) {
          throw new Error('User not found');
        }

        // Check if already invited or is owner
        if (video.userId.toString() === userToInvite._id.toString()) {
          throw new Error('User is the video owner');
        }

        if (video.invitedUsers.includes(email)) {
          throw new Error('User is already invited');
        }

        video.invitedUsers.push(email);
        await video.save();

        // Get the inviter's name
        const inviter = await User.findById(user.userId);
        const inviterName = inviter?.name || inviter?.username || 'Someone';

        return { video, userToInvite, inviterName };
      },
      'Failed to invite user'
    );

    const { video, userToInvite, inviterName } = result;

    // Send invitation email
    const videoLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/video/${video._id}`;

    try {
      await sendInvitationEmail({
        toEmail: userToInvite.email,
        toName: userToInvite.name || userToInvite.username,
        videoTitle: video.title,
        videoLink,
        inviterName,
      });
      console.log(`Invitation email sent to ${userToInvite.email}`);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the invitation if email fails, just log it
    }

    // No need to populate invitedUsers since it's now an array of emails
    return NextResponse.json({ video }, { status: 200 });
  } catch (error: any) {
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// Remove invited user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const emailToRemove = searchParams.get('email');

    if (!emailToRemove) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const video = await executeDbOperation(
      async () => {
        const video = await Video.findById(id);

        if (!video) {
          throw new Error('Video not found');
        }

        // Only owner can remove users
        if (video.userId.toString() !== user.userId) {
          throw new Error('Only the video owner can remove users');
        }

        video.invitedUsers = video.invitedUsers.filter((email: string) => email !== emailToRemove);
        await video.save();

        return video;
      },
      'Failed to remove user'
    );

    return NextResponse.json({ video }, { status: 200 });
  } catch (error: any) {
    console.error('Remove user error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
