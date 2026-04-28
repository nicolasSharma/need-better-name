import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import '@/config/firebase';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
