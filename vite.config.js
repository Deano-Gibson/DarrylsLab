import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: [
        'index.html',
        'in-person.html',
        'terms.html',
        'account.html',
        'online.html',
        'connect-calendar.html',
      ],
    },
  },
});
