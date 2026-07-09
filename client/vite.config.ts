import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': '/src',
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
					'vendor-ui': ['@chakra-ui/react', 'framer-motion', '@emotion/react', '@emotion/styled'],
					'vendor-router': ['react-router-dom'],
				},
			},
		},
	},
});
