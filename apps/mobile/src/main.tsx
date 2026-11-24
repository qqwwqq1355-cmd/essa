import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nManager } from 'react-native';
import App from './App';

// تفعيل RTL أصلي للغة العربية
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {
  // في المتصفح يعتمد الاتجاه أيضاً على dir="rtl" في index.html
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

