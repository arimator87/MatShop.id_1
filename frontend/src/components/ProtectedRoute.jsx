import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-[60vh] grid place-items-center" data-testid="auth-loading">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};
