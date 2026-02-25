import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import { initAnalytics } from './analytics/ga';
import { startWebVitalsTracking } from './analytics/webVitals';

initAnalytics();
startWebVitalsTracking();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
