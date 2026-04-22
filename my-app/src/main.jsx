import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import FlowForge from './sample.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FlowForge />
  </StrictMode>,
)
