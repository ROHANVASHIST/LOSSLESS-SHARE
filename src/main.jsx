import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </React.StrictMode>
);
