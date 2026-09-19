import { createRouter, createWebHistory } from 'vue-router';
import { authStore } from './stores/auth';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('./views/HomeView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools',
            name: 'tools',
            component: () => import('./views/ToolsView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/weighbridge',
            name: 'tools-weighbridge',
            component: () => import('./views/tools/WeighbridgeView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/allocator',
            name: 'tools-allocator',
            component: () => import('./views/tools/AllocatorView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/vehicles',
            name: 'tools-vehicles',
            component: () => import('./views/tools/VehiclesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/minutes',
            name: 'tools-minutes',
            component: () => import('./views/tools/MinutesView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/utilities',
            name: 'tools-utilities',
            component: () => import('./views/tools/UtilitiesView.vue'),
            meta: { requiresAuth: true }
        },
        // Legacy redirects for backward compatibility
        { path: '/tools/printer', redirect: '/tools/weighbridge' },
        { path: '/tools/converter', redirect: '/tools/utilities?tab=converter' },
        { path: '/tools/merger', redirect: '/tools/utilities?tab=merger' },
        { path: '/tools/ocr', redirect: '/tools/utilities?tab=ocr' },
        {
            path: '/documents',
            name: 'documents',
            component: () => import('./views/DocumentsView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/admin',
            name: 'admin',
            component: () => import('./views/AdminView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/about',
            name: 'about',
            component: () => import('./views/AboutView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/login',
            name: 'login',
            component: () => import('./views/LoginView.vue')
        },
        {
            path: '/change-password',
            name: 'change-password',
            component: () => import('./views/ChangePasswordView.vue'),
            meta: { requiresAuth: true }
        }
    ]
});

router.beforeEach((to, _from, next) => {
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/login');
    } else if (to.path === '/admin' && authStore.isFirstLogin) {
        next('/change-password');
    } else if (to.path === '/admin' && authStore.role !== 'admin') {
        next('/');
    } else {
        next();
    }
});

export default router;
