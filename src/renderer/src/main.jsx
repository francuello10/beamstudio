import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { dmxScheduler } from './services/DmxScheduler'

// Initialize independent DMX engine
dmxScheduler.start()

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
