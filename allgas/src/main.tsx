import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App';
import './styles.css';

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
  document.getElementById('root')!.innerHTML =
    '<main class="wrap"><h1>Preventah All Gas</h1><p class="bad">VITE_CONVEX_URL is not set. Run <code>npx convex dev</code> once to create a deployment, then restart Vite.</p></main>';
} else {
  const convex = new ConvexReactClient(url);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </React.StrictMode>,
  );
}
