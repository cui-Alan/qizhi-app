import { create } from "zustand";
import type { Role } from "@/types";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar_url?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: () => boolean;
}

// Mock admin account for MVP
const mockUser: AuthUser = {
  id: "admin-001",
  email: "admin@qizhi.chat",
  name: "管理员",
  role: "super_admin",
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,

  login: async (email: string, _password: string) => {
    set({ loading: true });
    // Simulate auth — replace with Supabase Auth later
    await new Promise((r) => setTimeout(r, 600));

    if (email === "admin@qizhi.chat") {
      set({ user: mockUser, loading: false });
      return true;
    }

    // Accept any @qizhi.chat email as valid user for MVP
    if (email.endsWith("@qizhi.chat")) {
      set({
        user: {
          id: `user-${Date.now()}`,
          email,
          name: email.split("@")[0],
          role: "user",
        },
        loading: false,
      });
      return true;
    }

    set({ loading: false });
    return false;
  },

  logout: () => {
    set({ user: null });
  },

  isAdmin: () => {
    const role = get().user?.role;
    return role === "super_admin" || role === "admin";
  },
}));
