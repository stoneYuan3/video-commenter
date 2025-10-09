# Testing Guide - Video Commenter App

## Server is Running at: http://localhost:3001

## Step-by-Step Test Flow:

### 1. Test Authentication

**Signup:**
1. Go to http://localhost:3001
2. You'll be redirected to `/login`
3. Click "Sign up" link at the bottom
4. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: test123
   - Confirm Password: test123
5. Click "Sign Up"
6. Should auto-login and redirect to dashboard

**Login (if needed):**
1. Go to http://localhost:3001/login
2. Use the credentials you created
3. Click "Sign In"

### 2. Create a YouTube Video

1. On the dashboard, click "+ New Video"
2. Enter a title: "Test YouTube Video"
3. Paste a YouTube URL (example): `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
4. Click "Create"
5. Should redirect to the video page with the player loaded

**✅ YouTube Video Loading Check:**
- The YouTube player should appear (black box with video)
- Timeline should show below the video
- Current time should update as video plays

### 3. Test Comments

**Add a timestamp comment:**
1. Let the video play to ~5 seconds
2. Type in the comment box: "This is a test comment"
3. Click "Add"
4. Comment should appear in the comments list below
5. A colored marker should appear on the timeline at 5 seconds

**Add a time range comment:**
1. Click and drag on the timeline from 10s to 15s
2. Type: "This is a range comment"
3. Click "Add"
4. Comment should show with "RANGE" badge
5. A colored bar should appear on the timeline from 10s to 15s

**Test timeline interaction:**
1. Click on a comment's timestamp - video should jump to that time
2. Hover over timeline markers - tooltip should show comment text
3. Click directly on timeline markers - video should seek to that position

### 4. Test Edit/Delete Comments

**Edit your comment:**
1. Find one of your comments in the list
2. Click "Edit" button (only appears on your comments)
3. Change the text
4. Click "Save"
5. Comment should update

**Delete your comment:**
1. Find a comment you created
2. Click "Delete" button
3. Confirm deletion
4. Comment should disappear from list and timeline

### 5. Test Google Drive Video

1. Go back to dashboard (click "Back to Dashboard")
2. Click "+ New Video"
3. Enter title: "Test Google Drive Video"
4. Paste a Google Drive video URL:
   - Format: `https://drive.google.com/file/d/FILE_ID_HERE/view`
   - Note: The file must be shared publicly ("Anyone with the link can view")
5. Click "Create"
6. Google Drive player should load in an iframe

### 6. Test Logout

1. Click "Logout" button on dashboard
2. Should redirect to login page
3. Cookie should be cleared

### 7. Test Dashboard Grid

1. Login again
2. Dashboard should show all your videos in a 3-column grid
3. Each video should show:
   - Thumbnail (for YouTube)
   - Source badge (YouTube/Google Drive)
   - Title
   - Date created
4. Click on any video card to open it

## Common Issues & Solutions:

### YouTube Player Not Loading:
- Check browser console for errors (F12)
- Make sure YouTube URL is valid
- The video might be region-restricted or embed-disabled

### Google Drive Video Not Playing:
- Make sure the file is shared publicly
- Go to Google Drive → Right-click file → Share → Change to "Anyone with the link"

### Comments Not Saving:
- Check MongoDB connection in `.env.local`
- Check browser console for API errors
- Make sure you're logged in (check for token cookie in DevTools)

### "Unauthorized" Errors:
- Token might have expired (7 days)
- Clear cookies and login again
- Check `.env.local` has correct JWT_SECRET

## Database Verification:

You can check your MongoDB Atlas database to verify data is being saved:
1. Go to https://cloud.mongodb.com
2. Click "Browse Collections"
3. Select "video-commenter" database
4. Check collections:
   - `users` - should have your user
   - `videos` - should have created videos
   - `comments` - should have your comments

## Features Working:

✅ User signup/login
✅ JWT authentication
✅ Dashboard with video grid
✅ Create YouTube videos
✅ Create Google Drive videos
✅ Video player with timeline
✅ Add timestamp comments
✅ Add time range comments
✅ Edit own comments
✅ Delete own comments
✅ Comment ownership (Edit/Delete only appear for your comments)
✅ Colored timeline markers
✅ Hover tooltips on timeline
✅ Real-time comment display during playback
✅ Logout functionality

## Next Steps (Optional Enhancements):

- [ ] File upload support (requires AWS S3 or similar)
- [ ] Share videos with other users
- [ ] Comment replies/threads
- [ ] Video thumbnails for uploaded videos
- [ ] Search/filter videos
- [ ] User profile settings
- [ ] Email verification
- [ ] Password reset
