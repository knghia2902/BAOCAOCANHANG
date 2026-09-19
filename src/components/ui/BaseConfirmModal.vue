<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

const props = withDefaults(defineProps<{
    show: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}>(), {
    confirmText: 'X�c nh?n',
    cancelText: 'H?y b?',
    type: 'warning'
});

const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
    (e: 'close'): void;
}>();

const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.show) {
        emit('cancel');
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});

watch(() => props.show, (isOpen) => {
    if (typeof document !== 'undefined') {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div 
                v-if="show" 
                class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
                @click.self="emit('cancel')"
            >
                <div 
                    class="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-primary/10 transform transition-all animate-in zoom-in-95"
                >
                    <div class="flex items-center gap-4 mb-4">
                        <div 
                            :class="[
                                'size-12 rounded-2xl flex items-center justify-center shrink-0',
                                type === 'danger' ? 'bg-red-50 text-red-500' :
                                type === 'warning' ? 'bg-amber-50 text-amber-500' :
                                'bg-blue-50 text-blue-500'
                            ]"
                        >
                            <span class="material-symbols-outlined text-2xl">
                                {{ type === 'danger' ? 'error' : type === 'warning' ? 'warning' : 'info' }}
                            </span>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-gray-900">{{ title }}</h3>
                            <p class="text-xs text-gray-500 font-medium">C?ng Nguy�n Ng?c Verification</p>
                        </div>
                    </div>

                    <p class="text-sm text-gray-600 leading-relaxed mb-6">{{ message }}</p>

                    <div class="flex items-center justify-end gap-3">
                        <button 
                            type="button"
                            @click="emit('cancel')"
                            class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors"
                        >
                            {{ cancelText }}
                        </button>
                        <button 
                            type="button"
                            @click="emit('confirm')"
                            :class="[
                                'px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition-all',
                                type === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                                type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                                'bg-primary hover:bg-primary-dark'
                            ]"
                        >
                            {{ confirmText }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
