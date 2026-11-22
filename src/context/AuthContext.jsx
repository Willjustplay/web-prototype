import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getLocalUserAvatar, saveLocalUserAvatar } from "@/lib/api";
import { AuthModal } from "@/components/layout/AuthModal";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = "wjp_token";

const setAuthHeader = (t) => {
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  else delete api.defaults.headers.common.Authorization;
};

const hydrateUserAvatar = (u) => {
  if (!u || typeof u !== "object") return u;
  const localAv = getLocalUserAvatar(u);
  if (u.avatar && String(u.avatar).trim()) {
    saveLocalUserAvatar(u, u.avatar);
    return u;
  }
  if (localAv) {
    return { ...u, avatar: localAv };
  }
  return u;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    setAuthHeader(token);
    api
      .get("/auth/me")
      .then((r) => setUser(hydrateUserAvatar(r.data)))
      .catch((err) => {
        if (err.response) {
          localStorage.removeItem(TOKEN_KEY);
          setAuthHeader("");
        }
        setUser(null);
      });
  }, []);

  const persist = (token, u) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthHeader(token);
    setUser(hydrateUserAvatar(u));
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data.token, data.user);
    return data.user;
  };

  const adminLogin = async (password) => {
    const { data } = await api.post("/auth/admin-login", { password });
    persist(data.token, data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    if (data.token) {
      persist(data.token, data.user);
    }
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
  };

  const logout = () => {
    api.post("/auth/logout").catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setAuthHeader("");
    setUser(null);
  };

  const openAuth = (tab = "login") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  const isWishlisted = (pid) => !!user?.wishlist?.includes(pid);

  const toggleWishlist = async (pid) => {
    if (!user) {
      openAuth("login");
      return;
    }
    try {
      const { data } = await api.post(`/me/wishlist/${pid}`);
      setUser((u) => ({ ...u, wishlist: data.wishlist }));
    } catch {
      toast.error("Gagal memperbarui wishlist. Coba lagi.");
    }
  };

  const updateProfile = async (nameOrPayload, maybeAvatar) => {
    const rawBody =
      nameOrPayload && typeof nameOrPayload === "object"
        ? nameOrPayload
        : {
            ...(nameOrPayload !== undefined ? { name: nameOrPayload } : {}),
            ...(maybeAvatar !== undefined ? { avatar: maybeAvatar } : {}),
          };

    const nextName =
      rawBody.name !== undefined && String(rawBody.name).trim()
        ? String(rawBody.name).trim()
        : user?.name || "Member";
    const nextAvatar =
      rawBody.avatar !== undefined ? String(rawBody.avatar).trim() : user?.avatar;

    if (nextAvatar) {
      saveLocalUserAvatar(user, nextAvatar);
    }

    // Optimistic state update so UI reflects avatar/name change immediately
    setUser((u) =>
      u
        ? {
            ...u,
            name: nextName,
            ...(nextAvatar !== undefined ? { avatar: nextAvatar } : {}),
          }
        : u
    );

    const payload = {
      name: nextName,
      ...(nextAvatar !== undefined ? { avatar: nextAvatar } : {}),
    };

    try {
      const { data } = await api.patch("/me/profile", payload);
      if (data?.user) {
        setUser((u) => ({
          ...u,
          ...data.user,
          name: data.user.name || nextName,
          avatar: nextAvatar || data.user.avatar || u?.avatar || "",
        }));
      }
      return data;
    } catch (err) {
      // If only changing avatar and backend route wasn't restarted yet, keep local avatar change working smoothly
      if (rawBody.avatar !== undefined && rawBody.name === undefined) {
        return { user: { ...user, name: nextName, avatar: nextAvatar } };
      }
      throw err;
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      const hydrated = hydrateUserAvatar(data);
      setUser(hydrated);
      return hydrated;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        initializing: user === undefined,
        login,
        adminLogin,
        register,
        logout,
        openAuth,
        isWishlisted,
        toggleWishlist,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
      <AuthModal
        open={authOpen}
        tab={authTab}
        setTab={setAuthTab}
        onClose={() => setAuthOpen(false)}
        onLogin={login}
        onRegister={register}
        onForgot={forgotPassword}
      />
    </AuthContext.Provider>
  );
};
