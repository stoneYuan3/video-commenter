# Video Commenter

A collaborative video reviewing and feedback platform built with Next.js, MongoDB, and TypeScript. Users can upload or link videos (YouTube, Google Drive) and add timestamp-based comments with threading capabilities.

## Project Overview

**Video Commenter** enables teams to review videos collaboratively with precise timestamp-based feedback. Comments appear as color-coded markers on an interactive timeline, supporting both single-point and time-range annotations. The platform includes user authentication, permission management, and email invitations for sharing videos.

### Key Features

- **Multi-source Video Support**: YouTube embeds, Google Drive previews, and local uploads
- **Timeline Comments**: Timestamp-based comments with visual timeline markers
- **Time Range Selection**: Drag on timeline to comment on video segments
- **Comment Threading**: Reply to comments with nested discussions
- **Collaborative Sharing**: Invite users via email with three permission levels
- **Permission Management**: Control who can view and comment on videos
- **Dashboard**: Manage owned and shared videos in one place
- **Color-coded Timeline**: 13 colors for visual comment organization

## Technology Stack

### Frontend
- **React 19.1.0** with **Next.js 15.5.4** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS 4** (PostCSS)
- YouTube IFrame API for video playback

### Backend
- **Next.js API Routes** (serverless functions)
- **JWT Authentication** (cookie-based)
- **bcryptjs** for password hashing
- **nodemailer** for email delivery

### Database
- **MongoDB Atlas** (cloud-hosted)
- **Mongoose 8.19.1** (ODM)

### Deployment
- **Vercel** (optimized with Turbopack)
- Vercel Analytics & Speed Insights

## Project Structure

```
video-commenter/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── videos/               # Video management
│   │   │   └── comments/             # Comment CRUD
│   │   ├── login/                    # Login page
│   │   ├── signup/                   # Registration page
│   │   ├── dashboard/                # Video dashboard
│   │   ├── video/
│   │   │   ├── new/                  # Create video
│   │   │   └── [id]/                 # Video player with comments
│   │   └── accept-invite/            # Accept invitation
│   ├── lib/                          # Utilities
│   │   ├── mongodb.ts                # Connection with caching
│   │   ├── auth.ts                   # JWT verification
│   │   ├── email.ts                  # Email sending
│   │   └── dbUtils.ts                # DB operation wrapper
│   └── models/                       # Mongoose schemas
│       ├── User.ts
│       ├── Video.ts
│       └── Comment.ts
└── public/                           # Static assets
```

## Data Models

### User
```typescript
{
  email: string (unique),
  password: string (hashed),
  name: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Video
```typescript
{
  userId: ObjectId,                   // Owner
  title: string,
  videoSource: 'youtube' | 'upload' | 'gdrive',
  videoId?: string,                   // YouTube ID
  gdriveId?: string,                  // Google Drive ID
  uploadedVideoUrl?: string,
  thumbnail?: string,
  duration: number,
  permission: 'invited-only' | 'anyone-view' | 'anyone-edit',
  invitedUsers: [{
    email: string,
    accepted: boolean,
    userId?: ObjectId,
    invitedAt: Date
  }],
  lastOpenedBy: Map<userId, Date>,    // Track user activity
  createdAt: Date,
  updatedAt: Date
}
```

### Comment
```typescript
{
  videoId: ObjectId,
  userId: ObjectId,
  text: string,
  timestamp?: number,                 // Single point (seconds)
  timeRange?: {                       // Or time range
    start: number,
    end: number
  },
  timeString: string,                 // Formatted display
  color: string,                      // Hex color for timeline
  parentCommentId?: ObjectId,         // For replies
  replies: ObjectId[],
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login (JWT cookie)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user ID

### Videos
- `GET /api/videos` - Get owned videos
- `POST /api/videos` - Create video
- `GET /api/videos/accessible` - Get owned + shared videos
- `GET /api/videos/[id]` - Get specific video
- `DELETE /api/videos/[id]` - Delete video (owner only)
- `POST /api/videos/[id]/invite` - Invite user
- `DELETE /api/videos/[id]/invite` - Remove invited user
- `POST /api/videos/[id]/accept-invite` - Accept invitation
- `PATCH /api/videos/[id]/permissions` - Update permissions

### Comments
- `GET /api/comments?videoId=[id]` - Get all comments
- `POST /api/comments` - Create comment/reply
- `PUT /api/comments/[id]` - Edit comment (author only)
- `DELETE /api/comments/[id]` - Delete comment (author only)

## Permission System

Three permission levels for video sharing:

1. **invited-only** (default): Only owner + invited users can view/comment
2. **anyone-view**: Anyone with link can view, only invited users can comment
3. **anyone-edit**: Anyone with link can view and comment (requires account)

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- SMTP server (optional, for email invitations)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd video-commenter
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (`.env.local`):
```bash
MONGODB_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-secret-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Optional: Email configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=465
SMTP_USER=your-email
SMTP_PASSWORD=your-password
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

### First Time Setup

1. Navigate to `/signup` to create an account
2. Login at `/login`
3. Create a video at `/video/new` with a YouTube URL
4. Add timestamp comments by clicking on the timeline
5. Invite collaborators via email using the "Invite Users" button

## Development

```bash
# Development server (Turbopack)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Notable Features & Implementation

### Timeline Comment System
- Comments marked with exact timestamp or time range
- Visual markers on interactive timeline
- Color-coded (13 available colors)
- Hover preview on timeline
- Auto-scroll to active comments

### Multi-Source Video Support
- **YouTube**: Embedded player with IFrame API
- **Google Drive**: Embedded preview
- **Local Uploads**: HTML5 video player (infrastructure ready, requires cloud storage setup)

### Invitation Flow
1. Owner sends email invitation with acceptance link
2. Invited user clicks link (can create account during acceptance)
3. Invitation status tracked (pending/accepted)
4. User gains access based on video permission level

### Security
- Passwords hashed with bcryptjs (10 salt rounds)
- JWT tokens in HTTP-only cookies (7-day expiration)
- Owner-only checks for sensitive operations
- Permission validation on all video access
- Email verification for invitations

## Database Connection

MongoDB connection implements caching for serverless environments:
- Connection pooling and timeout handling
- Auto-reconnect on connection loss
- Detailed logging for debugging
- Optimized for Vercel serverless functions

## Known Limitations

- File upload feature requires cloud storage configuration (AWS S3, Cloudflare R2, etc.)
- Google Drive upload UI hidden (infrastructure ready)
- Email invitations require SMTP configuration
- No real-time updates (polling-based UI)

## Recent Updates

Recent commits focused on:
- Fixing 500 server errors with enhanced logging
- MongoDB connection stability improvements
- Timeline hint additions
- Error message improvements

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The app is optimized for Vercel with:
- Turbopack for faster builds
- Serverless API routes
- MongoDB connection caching
- Vercel Analytics integration

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for details.

## Contributing

This project was created for HackVan 2025. Contributions are welcome!

## License

[Add your license here]

## Support

For issues or questions, please open an issue in the GitHub repository.
