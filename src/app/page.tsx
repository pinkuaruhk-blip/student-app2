"use client";

import { SignedIn, SignedOut, Login } from "@/components/auth-provider";
import { db } from "@/lib/db";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = db.useAuth();

  // Redirect authenticated users to pipes page
  useEffect(() => {
    if (user && !isLoading) {
      router.push("/pipes");
    }
  }, [user, isLoading, router]);

  return (
    <div>
      <SignedOut>
        <Login />
      </SignedOut>
      <SignedIn>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting...</p>
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
