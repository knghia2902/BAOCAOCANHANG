import { supabase } from '@/supabase';

export interface UserMessage {
    id?: number | string;
    name: string;
    email: string;
    content: string;
    date: string;
    isRead?: boolean;
}

export const MessageService = {
    async sendMessage(msg: UserMessage): Promise<boolean> {
        const { error } = await supabase.from('messages').insert([msg]);
        return !error;
    },

    async deleteMessage(id: any): Promise<boolean> {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        return !error;
    },

    async markMessageAsRead(id: any): Promise<boolean> {
        const { error } = await supabase.from('messages').update({ isRead: true }).eq('id', id);
        return !error;
    }
};
