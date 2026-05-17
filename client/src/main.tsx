import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import '@/config/firebase';

window.onerror = (msg, url, lineNo, columnNo, error) => {
	console.error('GLOBAL CRASH:', msg, error);
	return false;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
