import { reactive, watch } from 'vue';
import { authService } from '../services/storage/AuthService';

interface AuthState {
    isAuthenticated: boolean;
    user: string | null;
    role: 'admin' | 'staff' | null;
    displayName: string | null;
    avatar: string | null;
    isFirstLogin: boolean;
}

const STORAGE_KEY = 'auth_session';

const savedState = localStorage.getItem(STORAGE_KEY);
const saved = savedState ? JSON.parse(savedState) : null;
const initialState: AuthState = {
    isAuthenticated: saved?.isAuthenticated ?? false,
    user: saved?.user ?? null,
    role: saved?.role ?? (saved?.isAuthenticated ? 'admin' : null),
    displayName: saved?.displayName ?? (saved?.isAuthenticated ? 'Admin' : null),
    avatar: saved?.avatar ?? null,
    isFirstLogin: saved?.isFirstLogin ?? false
};

export const authStore = reactive<AuthState>(initialState);

// Persistence for Session (keep login on refresh)
watch(authStore, (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
});

export const login = async (username: string, pass: string) => {
    const res = await authService.login(username, pass);
    if (res.success && res.user) {
        authStore.isAuthenticated = true;
        authStore.user = res.user.username;
        authStore.role = res.user.role;
        authStore.displayName = res.user.displayName || res.user.username;
        authStore.avatar = res.user.avatar || null;
        authStore.isFirstLogin = res.isFirstLogin || false;
        return true;
    }
    return false;
};

export const logout = () => {
    authStore.isAuthenticated = false;
    authStore.user = null;
    authStore.role = null;
    authStore.displayName = null;
    authStore.avatar = null;
    authStore.isFirstLogin = false;
};

export const updateStoreProfile = (displayName: string, avatarUrl?: string) => {
    authStore.displayName = displayName;
    if (avatarUrl !== undefined) {
        authStore.avatar = avatarUrl;
    }
};


