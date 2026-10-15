"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, authPersistence } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    const initializeAuth = async () => {
      try {
        await authPersistence;

        if (!active) return;

        unsubscribe = onAuthStateChanged(
          auth,
          (currentUser) => {
            setUser(currentUser);
            setLoading(false);
          },
          (error) => {
            console.error("Authentication error:", error);
            setUser(null);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Authentication initialization failed:", error);
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
