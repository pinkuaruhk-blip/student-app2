"use client";

import { db } from "@/lib/db";
import { useState } from "react";
import { useTranslations } from 'next-intl';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const { user, isLoading } = db.useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = db.useAuth();

  if (isLoading) {
    return null;
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}

export function Login() {
  const t = useTranslations('app');
  const [sentEmail, setSentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    db.auth.sendMagicCode({ email }).catch((err) => {
      alert("Error sending magic code: " + err.message);
    });

    setSentEmail(email);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    db.auth.signInWithMagicCode({ email: sentEmail, code }).catch((err) => {
      setCode("");
      alert("Invalid code. Please try again: " + (err.body?.message || err.message));
    });
  };

  if (sentEmail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-center mb-6">Enter your code</h2>
          <p className="text-gray-600 text-center mb-6">
            We sent a 6-digit code to <strong>{sentEmail}</strong>
          </p>

          <form onSubmit={handleVerifyCode}>
            <div className="mb-4">
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium mb-4"
            >
              Verify Code
            </button>
          </form>

          <button
            onClick={() => {
              setSentEmail("");
              setCode("");
            }}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-2">{t('name')}</h1>
        <p className="text-gray-600 text-center mb-8">{t('description')}</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Send magic code
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500 text-center">
          We'll send you a magic link to sign in without a password
        </p>
      </div>
    </div>
  );
}
