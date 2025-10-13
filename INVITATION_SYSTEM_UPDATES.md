# Invitation System - Remaining Updates

## Completed ✅
1. ✅ Updated Video model with InvitedUser structure (email, accepted, userId, invitedAt)
2. ✅ Updated invite endpoint to add users with accepted: false
3. ✅ Created accept invitation API endpoint
4. ✅ Created invitation acceptance page with signup flow
5. ✅ Updated email service to use Resend
6. ✅ Updated comments route permission checks

## Remaining Tasks

### 1. Update Video Routes Permission Checks

**Files to update:**
- `src/app/api/videos/[id]/route.ts` (line 33)
- `src/app/api/videos/accessible/route.ts` (line 23)

**Change needed:**
```typescript
// OLD:
const isInvited = user && video.invitedUsers.includes(user.email);

// NEW:
const isInvited = user && video.invitedUsers.some((invited: any) =>
  invited.email === user.email && invited.accepted
);
```

**For accessible route (line 20-24):**
```typescript
// OLD:
const videos = await Video.find({
  $or: [
    { userId: user.userId },
    { invitedUsers: user.email }
  ]
})

// NEW:
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
```

### 2. Update Frontend - Video Page

**File:** `src/app/video/[id]/page.tsx`

**Interface updates (line 37):**
```typescript
// Change from:
invitedUsers?: string[];

// To:
invitedUsers?: Array<{
  email: string;
  accepted: boolean;
  userId?: { _id: string; name: string; email: string };
  invitedAt: string;
}>;
```

**Invited Commenters UI (lines 1086-1107):**
```typescript
{video.invitedUsers && video.invitedUsers.length > 0 ? (
  video.invitedUsers.map((invited) => (
    <div key={invited.email} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
      <div className="flex-1">
        {invited.accepted && invited.userId ? (
          <>
            <p className="text-sm font-medium text-gray-800">{invited.userId.name}</p>
            <p className="text-xs text-gray-500">{invited.email}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-800">{invited.email}</p>
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
              Pending
            </span>
          </>
        )}
      </div>
      {isOwner && (
        <button
          onClick={() => removeInvitedUser(invited.email)}
          className="text-red-500 hover:text-red-700"
          title="Remove user"
        >
          {/* Delete icon */}
        </button>
      )}
    </div>
  ))
) : (
  <p className="text-sm text-gray-500 italic">No invited users yet</p>
)}
```

### 3. Update Frontend - Dashboard

**File:** `src/app/dashboard/page.tsx`

**Interface update (line 16):**
```typescript
// Change from:
invitedUsers?: string[];

// To:
invitedUsers?: Array<{
  email: string;
  accepted: boolean;
}>;
```

### 4. Update Video Access Messages

**File:** `src/app/video/[id]/page.tsx` (around lines 115-127)

**In the access denied section, add differentiation:**
```typescript
if (videoRes.status === 401 || videoRes.status === 403) {
  const errorData = await videoRes.json();
  if (errorData.accessDenied) {
    setAccessDenied(true);
    setOwnerEmail(errorData.ownerEmail || '');
    setVideoTitle(errorData.videoTitle || 'this video');
    setInvitationStatus(errorData.invitationStatus); // 'not-invited' | 'pending' | 'not-logged-in'
    setLoading(false);
    return;
  }
  // ...
}
```

**Update the accessDenied UI (around line 640):**
```typescript
if (accessDenied) {
  let message = '';
  let icon = '🔒';

  if (invitationStatus === 'pending') {
    icon = '📧';
    message = `You've been invited to view this video but haven't accepted the invitation yet. Please check your email (${currentUserEmail}) for the invitation link and click "Accept Invitation".`;
  } else if (invitationStatus === 'not-logged-in') {
    icon = '🔑';
    message = `This video requires you to be logged in. If you've been invited, please check your email for the invitation link.`;
  } else {
    icon = '🔒';
    message = `You do not have permission to view this video.`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        {/* Rest of UI */}
      </div>
    </div>
  );
}
```

### 5. Update Video GET Route to Return Invitation Status

**File:** `src/app/api/videos/[id]/route.ts` (around line 34-54)

**Add invitation status to response:**
```typescript
const invitedUser = user && video.invitedUsers.find((invited: any) =>
  invited.email === user.email
);

if (video.permission === 'invited-only') {
  if (!user) {
    return NextResponse.json({
      error: 'Unauthorized',
      accessDenied: true,
      videoTitle: video.title,
      ownerEmail: (video.userId as any)?.email,
      invitationStatus: 'not-logged-in'
    }, { status: 401 });
  }
  if (!isOwner && !isInvited) {
    const isPending = invitedUser && !invitedUser.accepted;
    return NextResponse.json({
      error: isPending
        ? 'Invitation pending. Please check your email to accept.'
        : 'Access denied. You are not invited to view this video.',
      accessDenied: true,
      videoTitle: video.title,
      ownerEmail: (video.userId as any)?.email,
      invitationStatus: isPending ? 'pending' : 'not-invited'
    }, { status: 403 });
  }
}
```

## Environment Variables Needed

Add to `.env.local`:
```
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=your-verified-email@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change in production
```

## Migration Script for Existing Data

If you have existing invited users as strings, you'll need to migrate them:

```javascript
// Add to migrate-invited-users.js or create new migration
video.invitedUsers = video.invitedUsers.map((emailOrUser) => {
  if (typeof emailOrUser === 'string') {
    // Old format: just email string
    return {
      email: emailOrUser,
      accepted: true, // Assume old invites were accepted
      invitedAt: new Date(),
    };
  }
  // Already new format
  return emailOrUser;
});
```

## Testing Checklist

- [ ] Invite user with existing account
- [ ] Verify email is sent via Resend
- [ ] Accept invitation while logged in
- [ ] Accept invitation while logged out
- [ ] Invite user without account
- [ ] Sign up through invitation link
- [ ] Check "Invited Commenters" UI shows pending/accepted status correctly
- [ ] Verify access control works for pending invitations
- [ ] Test removing invited users
- [ ] Test permission checks (invited-only, anyone-view, anyone-edit)
