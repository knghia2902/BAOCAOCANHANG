import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ContentState {
    hero: {
        title: string;
        subtitle: string;
        primaryButton: string;
        secondaryButton: string;
        position: { x: number; y: number };
        image: string;
        avatar: string;
    };
    visibility: {
        hero: boolean;
        skills: boolean;
        projects: boolean;
        sparkles: boolean;
    };
    stats: {
        visitors: number;
    };
    toolkit: Array<{ icon: string; label: string; tool?: string }>;
    projects: Array<{
        id: number;
        title: string;
        description: string;
        tag: string;
        image: string;
    }>;
    about: {
        email: string;
        social: Array<{ id: number; platform: string; url: string; icon: string; isSvg: boolean }>;
    };
    messages: Array<{ id: number; name: string; email: string; content: string; date: string; isRead?: boolean }>;
}

const defaultContentState: ContentState = {
    hero: {
        title: "Hi, I'm Ngoc Anh!",
        subtitle: "Designing digital dreams with a touch of magic. I create whimsical experiences that spark joy for people everywhere.",
        primaryButton: "See my tools",
        secondaryButton: "My Story",
        position: { x: 50, y: 50 },
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDxCJ9jnxEvcGHLMJ9qIRFXcQwSV-VJmsbVXnXszz5QNieKfQgXvHzChmw5X7lyzNyekshO8uguWEWnskJqALkUmryGpo00cXOHRV8YUmYSLqwJX4w9_IDB73NehyLPYMOUPA7KhKK2kUtn2bTw_mXPWgCfei2oAH4kuKAaZzJDVvIaJgf9vt8PtQwHUfgrh8ZppB1zRAz2rquSl4l5u1zFUu7NVpPS3lpo5HigDFd719ScBMFRIeYNf7-xUM4XtuVpPhc5g-iDYiJ",
        avatar: "https://ngocanhcute.vercel.app/avatar.jpg"
    },
    visibility: {
        hero: true,
        skills: true,
        projects: true,
        sparkles: false
    },
    stats: {
        visitors: 0
    },
    toolkit: [
        { icon: 'palette', label: 'UI Design', tool: '/tools' },
        { icon: 'brush', label: 'Illustration' },
        { icon: 'search', label: 'UX Research' },
        { icon: 'bolt', label: 'Prototyping' },
        { icon: 'verified', label: 'Branding' }
    ],
    projects: [
        {
            id: 1,
            title: "PinkyPal Finance",
            description: "Making personal budgeting fun and accessible with a gamified interface.",
            tag: "Mobile App",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDpyOZU63z80-gG8qighS06AKdJBzZeu9FQbZ-qPF8ziCtVwdAZRyovsPm-gxv7bwuY-nWEk-SmGiFwao3G1vwzOXIJ-lRi0xyFtPLzwHNJsOEyyqthZtYxRg6y41Dt3oiv8bYXV-KuxnemhACsYKwmxZx7I4z5aN20BrglTZdSgcPpt_sbi6jlBKNX4P2nMm530Gr0qfzVTmUN_N2v3t0m0PDsoENGj9zHbbfN0oBTDO8_zwZaMFcNoPqUL7v5PDO1EDcv6lgCqvLU"
        },
        {
            id: 2,
            title: "Doodle Library",
            description: "A set of 100+ hand-drawn vector elements for modern SaaS landing pages.",
            tag: "Illustration",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDxCJ9jnxEvcGHLMJ9qIRFXcQwSV-VJmsbVXnXszz5QNieKfQgXvHzChmw5X7lyzNyekshO8uguWEWnskJqALQkUmryGpo00cXOHRV8YUmYSLqwJX4w9_IDB73NehyLPYMOUPA7KhKK2kUtn2bTw_mXPWgCfei2oAH4kuKAaZzJDVvIaJgf9vt8PtQwHUfgrh8ZppB1zRAz2rquSl4l5u1zFUu7NVpPS3lpo5HigDFd719ScBMFRIeYNf7-xUM4XtuVpPhc5g-iDYiJ"
        }
    ],
    about: {
        email: "ngocanh.mai247@gmail.com",
        social: [
            { id: 1, platform: 'Facebook', url: '#', icon: 'facebook', isSvg: true },
            { id: 2, platform: 'Instagram', url: '#', icon: 'instagram', isSvg: true }
        ]
    },
    messages: []
};

export const useContentStore = defineStore('content', () => {
    const hero = ref(defaultContentState.hero);
    const visibility = ref(defaultContentState.visibility);
    const stats = ref(defaultContentState.stats);
    const toolkit = ref(defaultContentState.toolkit);
    const projects = ref(defaultContentState.projects);
    const about = ref(defaultContentState.about);
    const messages = ref(defaultContentState.messages);

    function updateContent(newContent: Partial<ContentState>) {
        if (newContent.hero) Object.assign(hero.value, newContent.hero);
        if (newContent.visibility) Object.assign(visibility.value, newContent.visibility);
        if (newContent.stats) Object.assign(stats.value, newContent.stats);
        if (newContent.toolkit) toolkit.value = newContent.toolkit;
        if (newContent.projects) projects.value = newContent.projects;
        if (newContent.about) Object.assign(about.value, newContent.about);
        if (newContent.messages) messages.value = newContent.messages;
    }

    return {
        hero,
        visibility,
        stats,
        toolkit,
        projects,
        about,
        messages,
        updateContent
    };
});

// Backward-compatible export for existing components
import { reactive } from 'vue';
export const contentStore = reactive(defaultContentState);
