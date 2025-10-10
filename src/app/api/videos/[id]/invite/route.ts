import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { sendInvitationEmail } from '@/lib/email';

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

    await connectDB();

    const { id } = await params;
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const video = await Video.findById(id);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if user is owner or invited user
    const isOwner = video.userId.toString() === user.userId;
    const isInvited = video.invitedUsers.some((id: any) => id.toString() === user.userId);

    if (!isOwner && !isInvited) {
      return NextResponse.json({ error: 'You do not have permission to invite users' }, { status: 403 });
    }

    // Find user to invite
    const userToInvite = await User.findOne({ email });

    if (!userToInvite) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already invited or is owner
    if (video.userId.toString() === userToInvite._id.toString()) {
      return NextResponse.json({ error: 'User is the video owner' }, { status: 400 });
    }

    if (video.invitedUsers.some((id: any) => id.toString() === userToInvite._id.toString())) {
      return NextResponse.json({ error: 'User is already invited' }, { status: 400 });
    }

    video.invitedUsers.push(userToInvite._id);
    await video.save();

    // Get the inviter's name
    const inviter = await User.findById(user.userId);
    const inviterName = inviter?.name || inviter?.username || 'Someone';

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

    // Populate invited users for response
    await video.populate('invitedUsers', 'username name');

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

    await connectDB();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userIdToRemove = searchParams.get('userId');

    if (!userIdToRemove) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const video = await Video.findById(id);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Only owner can remove users
    if (video.userId.toString() !== user.userId) {
      return NextResponse.json({ error: 'Only the video owner can remove users' }, { status: 403 });
    }

    video.invitedUsers = video.invitedUsers.filter((id: any) => id.toString() !== userIdToRemove);
    await video.save();

    // Populate invited users for response
    await video.populate('invitedUsers', 'username name');

    return NextResponse.json({ video }, { status: 200 });
  } catch (error: any) {
    console.error('Remove user error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
