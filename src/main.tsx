import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and suppress benign internal Firestore stream timeout warnings from console.error
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const isBenignFirestoreError = args.some(arg => {
    if (!arg) return false;
    const str = typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : String(arg));
    return (
      str.includes('Disconnecting idle stream') ||
      str.includes('Timed out waiting for new targets') ||
      str.includes('GrpcConnection RPC') ||
      str.includes('CANCELLED')
    );
  });

  if (isBenignFirestoreError) {
    console.info('Benign Firestore stream disconnection ignored.');
    return;
  }

  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

