import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './shared/ui/estilos.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('No existe el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
