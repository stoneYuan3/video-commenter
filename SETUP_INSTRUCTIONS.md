# Video Commenter - Backend Setup Complete

## What Has Been Created

### 1. Dependencies Installed
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `next-auth@beta` - Authentication library (for future enhancements)

### 2. Database Models
- **User Model** (`src/models/User.ts`) - Email, password, name
- **Video Model** (`src/models/Video.ts`) - Stores video metadata (YouTube, Google Drive, Upload)
- **Comment Model** (`src/models/Comment.ts`) - Comments with timestamps, time ranges, colors, and user ownership

### 3. API Routes Created

#### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login (sets JWT cookie)
- `POST /api/auth/logout` - User logout (clears cookie)

#### Videos
- `GET /api/videos` - Get all videos for logged-in user
- `POST /api/videos` - Create new video
- `GET /api/videos/[id]` - Get specific video
- `DELETE /api/videos/[id]` - Delete video and all its comments

#### Comments
- `GET /api/comments?videoId=XXX` - Get all comments for a video
- `POST /api/comments` - Create new comment
- `PUT /api/comments/[id]` - Edit comment (only owner)
- `DELETE /api/comments/[id]` - Delete comment (only owner)

### 4. Frontend Pages Created
- `/` - Redirects to login
- `/login` - Login page
- `/signup` - Signup page
- `/dashboard` - Shows user's videos in 3-column grid
- `/video/new` - Create new video page
- `/video/[id]/page.tsx` - Video player with comments (NEEDS UPDATE)

### 5. Utilities
- `src/lib/mongodb.ts` - MongoDB connection with caching
- `src/lib/auth.ts` - JWT verification helper

## What You Need to Do

### 1. Environment Variables
Edit `.env.local` and add your values:

```env
# Get this from MongoDB Atlas:
# 1. Go to mongodb.com/atlas
# 2. Create a cluster (free tier available)
# 3. Click "Connect" -> "Connect your application"
# 4. Copy the connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/video-commenter?retryWrites=true&w=majority

# Generate a random secret (32+ characters):
NEXTAUTH_SECRET=your-random-secret-here-min-32-chars

# This should be your app URL
NEXTAUTH_URL=http://localhost:3000

# Generate another random secret for JWT:
JWT_SECRET=another-random-secret-here-min-32-chars
```

### 2. Update Video Page
The file `src/app/video/[id]/page.tsx` needs to be updated to:
- Fetch video data from `/api/videos/[id]`
- Load comments from `/api/comments?videoId=[id]`
- Save new comments to the database
- Allow editing/deleting user's own comments
- Show comment author names
- Add "Edit" and "Delete" buttons for user's own comments

### 3. Test the Flow
1. Start the dev server: `npm run dev`
2. Go to `http://localhost:3000`
3. Sign up for an account
4. Create a new video (YouTube or Google Drive)
5. Add comments
6. Test edit/delete on your comments

## Current File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── signup/route.ts
│   │   │   └── logout/route.ts
│   │   ├── videos/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── comments/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── video/
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── page.tsx (NEEDS DATABASE INTEGRATION)
│   └── page.tsx (redirect to login)
├── lib/
│   ├── mongodb.ts
│   └── auth.ts
└── models/
    ├── User.ts
    ├── Video.ts
    └── Comment.ts
```

## Next Steps

The video page (`src/app/video/[id]/page.tsx`) is the original standalone version.
It needs to be updated to:

1. Use `useParams()` to get the video ID from the URL
2. Fetch video and comments from the API
3. Save comments to the database instead of local state
4. Add edit/delete functionality with ownership checks
5. Show comment author information

Would you like me to update this file now?

## Notes

- File uploads are not fully implemented (requires cloud storage like AWS S3)
- Google Drive videos work but have limited control (uses iframe)
- All routes are protected with JWT authentication
- Passwords are hashed with bcrypt
- Comments are color-coded and support both timestamps and time ranges
