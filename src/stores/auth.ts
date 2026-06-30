import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
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
  initialized: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      set({
        user: {
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
          role: (session.user.user_metadata?.role as Role) || "user",
        },
        initialized: true,
      });
    } else {
      set({ initialized: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      set({ loading: false });
      return { success: false, error: error?.message || "登录失败" };
    }

    // Query user role from database
    const { data: profile } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", data.user.id)
      .single();

    set({
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name: profile?.name || data.user.user_metadata?.name || email.split("@")[0],
        role: (profile?.role as Role) || "user",
      },
      loading: false,
    });

    return { success: true };
  },

  logout: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },

  isAdmin: () => {
    const role = get().user?.role;
    return role === "super_admin" || role === "admin";
  },
}));
