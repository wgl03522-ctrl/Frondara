import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('ROOT_ELEMENT_MISSING');

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
