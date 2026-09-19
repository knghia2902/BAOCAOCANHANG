import { supabase } from '@/supabase';
import { contentStore } from '@/stores/content';
import { UserService } from './auth/UserService';
import { PermissionService, DEFAULT_ROLE_PERMISSIONS } from './auth/PermissionService';
import { MessageService } from './cms/MessageService';

export const ContentService = {
    // CMS Portfolio
    async loadAll() {
        try {
            const { data: contentData } = await supabase
                .from('content')
                .select('*')
                .eq('id', 'main')
                .single();

            if (contentData) {
                if (contentData.hero) contentStore.hero = { ...contentStore.hero, ...contentData.hero };
                if (contentData.visibility) contentStore.visibility = { ...contentStore.visibility, ...contentData.visibility };
                if (contentData.stats) contentStore.stats = { ...contentStore.stats, ...contentData.stats };
                if (contentData.about) contentStore.about = { ...contentStore.about, ...contentData.about };
            }

            const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
            if (projectsData) {
                contentStore.projects = projectsData.map((p: any) => ({
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    tag: p.tag,
                    image: p.image
                }));
            }

            const { data: toolsData } = await supabase.from('tools').select('*').order('created_at', { ascending: true });
            if (toolsData) {
                contentStore.toolkit = toolsData.map((t: any) => ({
                    icon: t.icon,
                    label: t.label,
                    tool: t.tool
                }));
            }

            const { data: msgData } = await supabase.from('messages').select('*').order('date', { ascending: false });
            if (msgData) {
                contentStore.messages = msgData;
            }
        } catch (e) {
            console.error('Error loading content data', e);
        }
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
