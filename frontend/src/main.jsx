import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';  // Ensure your Tailwind CSS is imported
import '@coreui/coreui/dist/css/coreui.min.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
