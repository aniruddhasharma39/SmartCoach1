import React from 'react'
import ReactDOM from 'react-dom/client'
import './api'
import App from './App'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <ToastContainer />
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
