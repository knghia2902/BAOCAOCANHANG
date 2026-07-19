import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import ToolsView from './views/ToolsView.vue'
import AdminView from './views/AdminView.vue'
import AboutView from './views/AboutView.vue'
import DocumentsView from './views/DocumentsView.vue'
import LoginView from './views/LoginView.vue'
import ChangePasswordView from './views/ChangePasswordView.vue'
import { authStore } from './stores/auth'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
            meta: { requiresAuth: true }
        },
        {
            path: '/tools',
            name: 'tools',
            component: ToolsView,
            meta: { requiresAuth: true }
        },
        {
            path: '/documents',
            name: 'documents',
            component: DocumentsView,
            meta: { requiresAuth: true }
        },
        {
            path: '/tools/allocator',
            redirect: '/tools?tool=allocator'
        },
        {
            path: '/tools/printer',
            redirect: '/tools?tool=weighbridge'
        },
        {
            path: '/tools/vehicles',
            redirect: '/tools?tool=vehicles'
        },
        {
            path: '/tools/converter',
            redirect: '/tools?tool=converter'
        },
        {
            path: '/tools/merger',
            redirect: '/tools?tool=merger'
        },
        {
            path: '/tools/ocr',
            redirect: '/tools?tool=ocr'
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminView,
            meta: { requiresAuth: true }
        },
        {
            path: '/about',
            name: 'about',
            component: AboutView,
            meta: { requiresAuth: true }
        },
        {
            path: '/login',
            name: 'login',
            component: LoginView
        },
        {
            path: '/change-password',
            name: 'change-password',
            component: ChangePasswordView
        }
    ]
})

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

export default router
