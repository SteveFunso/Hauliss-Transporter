import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { loginAdmin, logout as logoutApi, type LoginResponse } from "../api/auth";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  profilePhotoUrl: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth state on mount
  useEffect(() => {
    const token = localStorage.getItem("hauliss_access_token");
    const savedUser = localStorage.getItem("hauliss_user");
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("hauliss_user");
      }
    }
    setIsLoading(false);
  }, []);

  // Listen for forced logout from API client (401)
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response: LoginResponse = await loginAdmin(email, password);

    const authUser: AuthUser = {
      id: response.user_id,
      email: response.profile.email,
      fullName: response.profile.full_name,
      role: response.role,
      profilePhotoUrl: response.profile.profile_photo_url,
    };

    localStorage.setItem("hauliss_access_token", response.access_token);
    localStorage.setItem("hauliss_refresh_token", response.refresh_token);
    localStorage.setItem("hauliss_user", JSON.stringify(authUser));

    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    logoutApi();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
