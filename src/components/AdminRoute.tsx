import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMeQuery } from "../store/authApi";

/**
 * Gates its children behind the admin role — the frontend counterpart to
 * requireAuth+requireAdmin on the server. This is a UX guard, not a
 * security boundary in itself: the actual protection is the server
 * rejecting non-admin requests to /api/people, which this can't bypass
 * even if someone reaches AdminPage's markup some other way.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMeQuery();

  if (isLoading) {
    return <p className="mt-8">Loading…</p>;
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  if (!data.person.isAdmin) {
    return (
      <p className="mt-8 rounded-xl border border-gray-400 p-5 text-center">
        You don't have access to this page.
      </p>
    );
  }

  return <>{children}</>;
}

export default AdminRoute;
