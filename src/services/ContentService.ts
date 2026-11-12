import { supabase } from '@/supabase';
import { contentStore } from '@/stores/content';
import { UserService } from './auth/UserService';
import { PermissionService, DEFAULT_ROLE_PERMISSIONS } from './auth/PermissionService';
import { MessageService } from './cms/MessageService';
import { SettingsService } from './storage/SettingsService';

let loadAllPromise: Promise<void> | null = null;
let lastLoadAllTime = 0;
const LOAD_ALL_TTL = 30_000;

export const ContentService = {
    // CMS Portfolio
    async loadAll(forceRefresh = false) {
        const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
        if (!isTest && !forceRefresh && lastLoadAllTime > 0 && (Date.now() - lastLoadAllTime < LOAD_ALL_TTL)) {
            return;
        }
        if (!isTest && loadAllPromise) {
            return loadAllPromise;
        }

        const runLoad = (async () => {
            try {
                const [contentRes, projectsRes, toolsRes, msgRes] = await Promise.all([
                    supabase.from('content').select('*').eq('id', 'main').single(),
                    supabase.from('projects').select('*').order('created_at', { ascending: false }),
                    supabase.from('tools').select('*').order('created_at', { ascending: true }),
                    supabase.from('messages').select('*').order('date', { ascending: false })
                ]);

                const contentData = contentRes.data;
                if (contentData) {
                    if (contentData.hero) contentStore.hero = { ...contentStore.hero, ...contentData.hero };
                    if (contentData.visibility) contentStore.visibility = { ...contentStore.visibility, ...contentData.visibility };
                    if (contentData.stats) contentStore.stats = { ...contentStore.stats, ...contentData.stats };
                    if (contentData.about) contentStore.about = { ...contentStore.about, ...contentData.about };
                    if (contentData.settings) {
                        SettingsService.setSettingsCache(contentData.settings);
                    }
                }

                const projectsData = projectsRes.data;
                if (projectsData) {
                    contentStore.projects = projectsData.map((p: any) => ({
                        id: p.id,
                        title: p.title,
                        description: p.description,
                        tag: p.tag,
                        image: p.image
                    }));
                }

                const toolsData = toolsRes.data;
                if (toolsData) {
                    contentStore.toolkit = toolsData.map((t: any) => ({
                        icon: t.icon,
                        label: t.label,
                        tool: t.tool
                    }));
                }

                const msgData = msgRes.data;
                if (msgData) {
                    contentStore.messages = msgData;
                }
                if (!isTest) {
                    lastLoadAllTime = Date.now();
                }
            } catch (e) {
                console.error('Error loading content data', e);
            }
        })();

        if (!isTest) {
            loadAllPromise = runLoad.finally(() => {
                loadAllPromise = null;
            });
            return loadAllPromise;
        }
        return runLoad;
    },

    getSettings: SettingsService.getSettings,
    updateSettings: SettingsService.updateSettings,
    invalidateSettingsCache() {
        lastLoadAllTime = 0;
        SettingsService.invalidateCache();
    },

    async saveAll() {
        try {
            const { error } = await supabase
                .from('content')
                .update({
                    hero: contentStore.hero,
                    visibility: contentStore.visibility,
                    stats: contentStore.stats,
                    about: contentStore.about,
                    updated_at: new Date()
                })
                .eq('id', 'main');

            if (!error) {
                ContentService.invalidateSettingsCache();
            }
            return !error;
        } catch (e) {
            console.error('Error saving content data', e);
            return false;
        }
    },

    async addProject(project: any) {
        const { data, error } = await supabase.from('projects').insert([project]).select();
        if (!error && data) return data[0];
        return null;
    },

    async updateProject(project: any) {
        const { id, ...updates } = project;
        const { error } = await supabase.from('projects').update(updates).eq('id', id);
        return !error;
    },

    async deleteProject(title: string) {
        const { error } = await supabase.from('projects').delete().eq('title', title);
        return !error;
    },

    async addTool(tool: any) {
        const { error } = await supabase.from('tools').insert([tool]);
        return !error;
    },

    async removeTool(label: string) {
        const { error } = await supabase.from('tools').delete().eq('label', label);
        return !error;
    },

    async incrementVisitors() {
        const { data, error: fetchError } = await supabase.from('content').select('stats').eq('id', 'main').single();
        if (fetchError || !data?.stats) return false;

        const currentVisitors = data.stats.visitors || 0;
        const newStats = {
            ...data.stats,
            visitors: currentVisitors + 1
        };

        const { error } = await supabase
            .from('content')
            .update({ stats: newStats })
            .eq('id', 'main');

        if (!error) {
            contentStore.stats.visitors = newStats.visitors;
        }
        return !error;
    },

    // Facade delegation to MessageService
    sendMessage: MessageService.sendMessage,
    deleteMessage: MessageService.deleteMessage,
    markMessageAsRead: MessageService.markMessageAsRead,

    // Facade delegation to UserService
    loadAccounts: UserService.loadAccounts,
    createUser: UserService.createUser,
    updateUser: UserService.updateUser,
    toggleUserStatus: UserService.toggleUserStatus,
    deleteUser: UserService.deleteUser,
    resetPassword: UserService.resetPassword,
    resetUserPassword: UserService.resetUserPassword,
    saveAccounts: UserService.saveAccounts,

    // Facade delegation to PermissionService
    loadStaffTools: PermissionService.loadStaffTools,
    saveStaffTools: PermissionService.saveStaffTools,
    loadRolePermissions: PermissionService.loadRolePermissions,
    saveRolePermissions: PermissionService.saveRolePermissions
};

export { UserService, PermissionService, MessageService, DEFAULT_ROLE_PERMISSIONS };
