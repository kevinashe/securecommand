console.log('[MAIN] ===== main.tsx module EXECUTING =====');
console.log('[MAIN] Timestamp:', new Date().toISOString());

console.log('[MAIN] Importing React...');
import { StrictMode } from 'react';
console.log('[MAIN] Importing ReactDOM...');
import { createRoot } from 'react-dom/client';
console.log('[MAIN] Importing App component...');
import App from './App.tsx';
console.log('[MAIN] Importing CSS...');
import './index.css';

console.log('[MAIN] All imports loaded successfully');

try {
  console.log('[MAIN] Attempting to render app...');
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('[MAIN] ERROR: Root element not found!');
  } else {
    console.log('[MAIN] Root element found, creating root...');
    const root = createRoot(rootElement);
    console.log('[MAIN] Root created, rendering App...');
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('[MAIN] ===== App rendered successfully =====');
  }
} catch (error) {
  console.error('[MAIN] ERROR rendering app:', error);
  console.error('[MAIN] Stack:', error instanceof Error ? error.stack : 'No stack trace');
}
