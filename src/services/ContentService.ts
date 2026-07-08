import { supabase } from '@/supabase';
import { contentStore } from '@/stores/content';

// Define explicit types or use 'any' carefully

export const ContentService = {
    // Fetch all data on app load
    async loadAll() {
        try {
            // 1. Load Global Content (Hero, Stats, Visibility, About)
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

            // 2. Load Projects
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

            // 3. Load Toolkit
            const { data: toolsData } = await supabase.from('tools').select('*').order('created_at', { ascending: true });
            if (toolsData) {
                contentStore.toolkit = toolsData.map((t: any) => ({
                    icon: t.icon,
                    label: t.label,
                    tool: t.tool
                }));
            }

            // 4. Load Messages
            const { data: msgData } = await supabase.from('messages').select('*').order('date', { ascending: false });
            if (msgData) {
                contentStore.messages = msgData;
            }

            console.log('Using Supabase Data');
        } catch (e) {
            console.error('Error loading data', e);
        }
    },

    // Save all changes
    async saveAll() {
        try {
            // 1. Update Global Content
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

            if (error) throw error;

            // Note: For Projects and Tools, simpler strategy for this demo:
            // We assume ContentStore is the source of truth. 
            // A proper sync would require tracking IDs. 
            // For now, to keep it simple and "Save" button based, we handle specific add/remove actions separately or just warn user.
            // Ideally, specific addProject/removeProject calls should be made immediately, not just on "Save".

            return true;
        } catch (e) {
            console.error('Error saving data', e);
            return false;
        }
    },

    // Specific Actions
    async addProject(project: any) {
        const { data, error } = await supabase.from('projects').insert([project]).select();
        if (!error && data) return data[0]; // Return the full object including ID
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

    async sendMessage(msg: any) {
        const { error } = await supabase.from('messages').insert([msg]);
        return !error;
    },

    async deleteMessage(id: any) {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        return !error;
    },

    async markMessageAsRead(id: any) {
        const { error } = await supabase.from('messages').update({ isRead: true }).eq('id', id);
        return !error;
    },

    async incrementVisitors() {
        // Get current stats
        const { data, error: fetchError } = await supabase.from('content').select('stats').eq('id', 'main').single();
        if (fetchError || !data?.stats) return false;

        const currentVisitors = data.stats.visitors || 0;
        const newStats = { visitors: currentVisitors + 1 };

        // Update with new count
        const { error } = await supabase
            .from('content')
            .update({ stats: newStats })
            .eq('id', 'main');

        if (!error) {
            contentStore.stats.visitors = newStats.visitors;
        }
        return !error;
    },

    // Accounts management
    async loadAccounts(): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (error || !data?.settings) return [];
            return data.settings.accounts || [];
        } catch (e) {
            console.error('Error loading accounts', e);
            return [];
        }
    },

    async saveAccounts(accounts: any[]): Promise<boolean> {
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (fetchError || !current?.settings) return false;
            
            const newSettings = {
                ...current.settings,
                accounts
            };
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            return !error;
        } catch (e) {
            console.error('Error saving accounts', e);
            return false;
        }
    },

    async loadStaffTools(): Promise<string[]> {
        try {
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (error || !data?.settings) return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
            return data.settings.staff_tools || ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        } catch (e) {
            console.error('Error loading staff tools config', e);
            return ['converter', 'merger', 'weighbridge', 'allocator', 'ocr'];
        }
    },

    async saveStaffTools(tools: string[]): Promise<boolean> {
        try {
            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (fetchError || !current?.settings) return false;
            
            const newSettings = {
                ...current.settings,
                staff_tools: tools
            };
            const { error } = await supabase
                .from('content')
                .update({ settings: newSettings })
                .eq('id', 'main');
            return !error;
        } catch (e) {
            console.error('Error saving staff tools config', e);
            return false;
        }
    }
};


