import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('Main.tsx loaded');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
      (registration) => {
        console.log('ServiceWorker registration successful');
      },
      (error) => {
        console.log('ServiceWorker registration failed:', error);
      }
    );
  });
}

try {
  console.log('Attempting to render app...');
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found!');
  } else {
    console.log('Root element found, creating root...');
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('App rendered successfully');
  }
} catch (error) {
  console.error('Error rendering app:', error);
}
