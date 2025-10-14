'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams?.get('videoId');
  const email = searchParams?.get('email');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  useEffect(() => {
    if (!videoId || !email) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    acceptInvitation();
  }, [videoId, email]);

  const acceptInvitation = async () => {
    try {
      setLoading(true);
      setError('');

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
      setHasAccount(data.hasAccount);
      setVideoTitle(data.videoTitle);
      setSignupEmail(email || '');

      if (data.hasAccount) {
        // User has account, check if they're logged in
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.email === email) {
            // User is logged in with the invited email, redirect to video
            router.push(`/video/${videoId}`);
            return;
          } else {
            // User is logged in with different email, ask them to login with invited email
            setError(`Please log out and log in with ${email} to access this video.`);
          }
        } else {
          // User has account but not logged in, redirect to login
          router.push(`/login?redirect=/video/${videoId}`);
        }
      }
      // If no account, show signup form (handled by state)
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupName.trim() || !signupPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSigningUp(true);
    setError('');

    try {
      // Sign up
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          name: signupName,
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
          email: signupEmail,
          password: signupPassword,
        }),
      });

      if (!loginRes.ok) {
        throw new Error('Account created but login failed. Please log in manually.');
      }

      // Accept invitation again now that user has account
      const acceptRes = await fetch(`/api/videos/${videoId}/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail }),
      });

      if (!acceptRes.ok) {
        console.error('Failed to finalize invitation acceptance');
      }

      // Redirect to video
      router.push(`/video/${videoId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 mb-2">Processing invitation...</div>
        </div>
      </div>
    );
  }

  if (!videoId || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invalid Invitation Link</h1>
          <p className="text-gray-600 mb-6">
            This invitation link is not valid. Please check your email for the correct link.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (hasAccount === null && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Show signup form for users without accounts
  if (hasAccount === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Sign Up Required</h1>
            <p className="text-gray-600">
              You've been invited to view <strong>{videoTitle}</strong>
            </p>
            <p className="text-gray-600 mt-2">
              Please create an account to accept the invitation.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={signupEmail}
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
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
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
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={signingUp}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingUp ? 'Creating Account...' : 'Create Account & Accept Invitation'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href={`/login?redirect=/accept-invite?videoId=${videoId}&email=${encodeURIComponent(email)}`} className="text-blue-500 hover:underline">
              Log in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
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
