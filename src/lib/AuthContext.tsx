"use client";
import React, { createContext, useContext, useState } from 'react';
import { User, mockUsers } from './mock-data';

export type Role = 'SUPER_ADMIN' | 'TEACHER';

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  role: 'SUPER_ADMIN', 
  setRole: () => {},
  currentUser: null,
  setCurrentUser: () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(mockUsers[0]);
  const role = currentUser?.role || 'SUPER_ADMIN';
  
  const setRole = (newRole: Role) => {
    if (newRole === 'SUPER_ADMIN') {
      setCurrentUser(mockUsers.find(u => u.role === 'SUPER_ADMIN') || null);
    } else {
      setCurrentUser(mockUsers.find(u => u.role === 'TEACHER') || null);
    }
  };

  return <AuthContext.Provider value={{ role, setRole, currentUser, setCurrentUser }}>{children}</AuthContext.Provider>
};

export const useAuth = () => useContext(AuthContext);
