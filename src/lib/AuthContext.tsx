"use client";
import React, { createContext, useContext, useMemo } from 'react';
import { useSession } from 'next-auth/react';

export type Role = 'SUPER_ADMIN' | 'TEACHER';

interface AuthContextType {
  role: Role;
  currentUser: { id: string; role: Role; fullName?: string } | null;
}


const AuthContext = createContext<AuthContextType>({ role: 'TEACHER', currentUser: null });


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();

  const { role, currentUser } = useMemo(() => {
    const r = session?.user?.role;
    const normalizedRole: Role = r === "SUPER_ADMIN" || r === "TEACHER" ? r : "TEACHER";

    const userId = session?.user?.id;
    const userFullName = session?.user?.fullName;

    const currentUser = userId
      ? { id: userId as string, role: normalizedRole, fullName: userFullName as string | undefined }
      : null;

    return { role: normalizedRole, currentUser };
  }, [session?.user?.role, session?.user?.id, session?.user?.fullName]);

  return <AuthContext.Provider value={{ role, currentUser }}>{children}</AuthContext.Provider>;
};

// Backward-compatible alias for existing code expecting `currentUser`.
export type LegacyAuthContextType = AuthContextType;



export const useAuth = () => useContext(AuthContext);
