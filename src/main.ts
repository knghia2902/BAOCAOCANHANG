import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
    console.error('[Global Error]', err, info);
};

app.use(router).mount('#app');
