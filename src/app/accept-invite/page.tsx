'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// State Machine Types
type PageState =
  | { status: 'LOADING' }
  | { status: 'INVALID_LINK'; missingVideoId: boolean; missingEmail: boolean }
  | { status: 'ERROR'; message: string }
  | { status: 'WRONG_ACCOUNT'; invitedEmail: string; currentEmail: string }
  | { status: 'SIGNUP_REQUIRED'; videoTitle: string; email: string; validationError?: string }
  | { status: 'SIGNING_UP'; videoTitle: string; email: string; validationError?: string }
  | { status: 'REDIRECTING' };

type FormData = {
  name: string;
  password: string;
};

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams?.get('videoId');
  const email = searchParams?.get('email');

  const [pageState, setPageState] = useState<PageState>({ status: 'LOADING' });
  const [formData, setFormData] = useState<FormData>({ name: '', password: '' });

  useEffect(() => {
    if (!videoId || !email) {
      setPageState({
        status: 'INVALID_LINK',
        missingVideoId: !videoId,
        missingEmail: !email
      });
      return;
    }

    acceptInvitation();
  }, [videoId, email]);

  const acceptInvitation = async () => {
    try {
      setPageState({ status: 'LOADING' });

      const res = await fetch(`/api/videos/${videoId}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accept invitation');
      }

      const data = await res.json();

      if (data.hasAccount) {
        // User has account, check if they're logged in
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.email === email) {
            // User is logged in with the invited email, redirect to video
            setPageState({ status: 'REDIRECTING' });
            window.location.href = `/video/${videoId}`;
            return;
          } else {
            // User is logged in with different email
            setPageState({
              status: 'WRONG_ACCOUNT',
              invitedEmail: email as string,
              currentEmail: userData.email
            });
            return;
          }
        } else {
          // User has account but not logged in, redirect to login
          setPageState({ status: 'REDIRECTING' });
          window.location.href = `/login?redirect=/video/${videoId}`;
          return;
        }
      }

      // If no account, show signup form
      setPageState({
        status: 'SIGNUP_REQUIRED',
        videoTitle: data.videoTitle,
        email: email as string
      });
    } catch (err: any) {
      setPageState({
        status: 'ERROR',
        message: err.message
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pageState.status !== 'SIGNUP_REQUIRED' && pageState.status !== 'SIGNING_UP') {
      return;
    }

    const { videoTitle, email } = pageState;

    if (!formData.name.trim() || !formData.password.trim()) {
      setPageState({
        status: 'SIGNING_UP',
        videoTitle,
        email,
        validationError: 'Please fill in all fields'
      });
      return;
    }

    if (formData.password.length < 6) {
      setPageState({
        status: 'SIGNING_UP',
        videoTitle,
        email,
        validationError: 'Password must be at least 6 characters'
      });
      return;
    }

    setPageState({ status: 'SIGNING_UP', videoTitle, email });

    try {
      // Sign up
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: formData.password,
          name: formData.name,
        }),
      });

      if (!signupRes.ok) {
        const data = await signupRes.json();
        throw new Error(data.error || 'Failed to create account');
      }

      // Auto-login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: formData.password,
        }),
      });

      if (!loginRes.ok) {
        throw new Error('Account created but login failed. Please log in manually.');
      }

      // Accept invitation again now that user has account
      const acceptRes = await fetch(`/api/videos/${videoId}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });

      if (!acceptRes.ok) {
        console.error('Failed to finalize invitation acceptance');
      }

      // Redirect to video
      setPageState({ status: 'REDIRECTING' });
      window.location.href = `/video/${videoId}`;
    } catch (err: any) {
      setPageState({
        status: 'SIGNING_UP',
        videoTitle,
        email,
        validationError: err.message
      });
    }
  };

  // Render based on state machine
  switch (pageState.status) {
    case 'LOADING':
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-600 mb-2">Processing invitation...</div>
          </div>
        </div>
      );

    case 'REDIRECTING':
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-600 mb-2">Redirecting...</div>
          </div>
        </div>
      );

    case 'INVALID_LINK':
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Invalid Invitation Link</h1>
            <div className="text-gray-600 mb-6">
              {pageState.missingVideoId && pageState.missingEmail ? (
                <p>This invitation link is missing both the video and email information. Please check your email for the correct link.</p>
              ) : pageState.missingVideoId ? (
                <p>The video ID is missing or incorrect. The video may have been deleted. Please contact the person who invited you.</p>
              ) : (
                <p>The email address is missing from the invitation link. Please check your email for the correct link.</p>
              )}
            </div>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Go to Login
            </button>
          </div>
        </div>
      );

    case 'ERROR':
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{pageState.message}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Go to Login
            </button>
          </div>
        </div>
      );

    case 'WRONG_ACCOUNT':
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Wrong Account</h1>
            <div className="text-gray-600 mb-6">
              {/* <p className="mb-2">You are currently logged in with <strong>{pageState.currentEmail}</strong>.</p> */}
              <p>Please log out and log in with <strong>{pageState.invitedEmail}</strong> to access this video.</p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Go to Login
            </button>
          </div>
        </div>
      );

    case 'SIGNUP_REQUIRED':
    case 'SIGNING_UP':
      const isSubmitting = pageState.status === 'SIGNING_UP' && !pageState.validationError;
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">📧</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Sign Up Required</h1>
              <p className="text-gray-600">
                You've been invited to view <strong>{pageState.videoTitle}</strong>
              </p>
              <p className="text-gray-600 mt-2">
                Please create an account to accept the invitation.
              </p>
            </div>

            {pageState.validationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {pageState.validationError}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={pageState.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account & Accept Invitation'}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <a
                href={`/login?redirect=/accept-invite?videoId=${videoId}&email=${encodeURIComponent(pageState.email)}`}
                className="text-blue-500 hover:underline"
              >
                Log in
              </a>
            </div>
          </div>
        </div>
      );

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = pageState;
      return null;
  }
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
