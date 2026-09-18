import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { User, StudentProfile } from '../types';

interface AuthContextType {
  user: User | null;
  student: StudentProfile | null;
  admin: { id: string; email: string; name: string } | null;
  token: string | null;
  isLoading: boolean;
  loginStudent: (
    usn: string,
    semesterNumber?: number,
    branchCode?: string,
    sectionName?: string,
    password?: string
  ) => Promise<void>;
  activateStudent: (usn: string, email: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  login: (token: string, user: User, student: StudentProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('aurora_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [student, setStudent] = useState<StudentProfile | null>(() => {
    const cached = localStorage.getItem('aurora_student');
    return cached ? JSON.parse(cached) : null;
  });
  const [admin, setAdmin] = useState<{ id: string; email: string; name: string } | null>(() => {
    const cached = localStorage.getItem('aurora_admin');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aurora_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on load via httpOnly cookie
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiRequest('/auth/me');
        setUser(res.user);
        if (res.student) {
          setStudent(res.student);
          localStorage.setItem('aurora_student', JSON.stringify(res.student));
        }
        if (res.admin) {
          setAdmin(res.admin);
          localStorage.setItem('aurora_admin', JSON.stringify(res.admin));
        }
        localStorage.setItem('aurora_user', JSON.stringify(res.user));
      } catch (err) {
        // Cookie expired/invalid or unauthenticated
        localStorage.removeItem('aurora_token');
        localStorage.removeItem('aurora_user');
        localStorage.removeItem('aurora_student');
        localStorage.removeItem('aurora_admin');
        setUser(null);
        setStudent(null);
        setAdmin(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginStudent = async (
    usn: string,
    semesterNumber?: number,
    branchCode?: string,
    sectionName?: string,
    password?: string
  ) => {
    const data = await apiRequest('/auth/student/login', {
      method: 'POST',
      data: { usn, semesterNumber, branchCode, sectionName, password },
    });
    if (data.token) {
      localStorage.setItem('aurora_token', data.token);
      setToken(data.token);
    }
    localStorage.setItem('aurora_user', JSON.stringify(data.user));
    localStorage.setItem('aurora_student', JSON.stringify(data.student));
    setUser(data.user);
    setStudent(data.student);
    setAdmin(null);
  };

  const activateStudent = async (usn: string, email: string, password: string) => {
    const data = await apiRequest('/auth/student/activate', {
      method: 'POST',
      data: { usn, email, password },
    });
    if (data.token) {
      localStorage.setItem('aurora_token', data.token);
      setToken(data.token);
    }
    localStorage.setItem('aurora_user', JSON.stringify(data.user));
    localStorage.setItem('aurora_student', JSON.stringify(data.student));
    setUser(data.user);
    setStudent(data.student);
    setAdmin(null);
  };

  const loginAdmin = async (email: string, password: string) => {
    const data = await apiRequest('/auth/admin/login', {
      method: 'POST',
      data: { email, password },
    });
    if (data.token) {
      localStorage.setItem('aurora_token', data.token);
      setToken(data.token);
    }
    localStorage.setItem('aurora_user', JSON.stringify(data.user));
    localStorage.setItem('aurora_admin', JSON.stringify(data.admin));
    setUser(data.user);
    setAdmin(data.admin);
    setStudent(null);
  };

  const login = (_newToken: string, newUser: User, newStudent: StudentProfile) => {
    if (_newToken) {
      localStorage.setItem('aurora_token', _newToken);
      setToken(_newToken);
    }
    localStorage.setItem('aurora_user', JSON.stringify(newUser));
    localStorage.setItem('aurora_student', JSON.stringify(newStudent));
    setUser(newUser);
    setStudent(newStudent);
    setAdmin(null);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      localStorage.removeItem('aurora_token');
      localStorage.removeItem('aurora_user');
      localStorage.removeItem('aurora_student');
      localStorage.removeItem('aurora_admin');
      setUser(null);
      setStudent(null);
      setAdmin(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        admin,
        token,
        isLoading,
        loginStudent,
        activateStudent,
        loginAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
