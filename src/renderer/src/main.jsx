import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import ProjectorApp from './output/ProjectorApp'
import { dmxScheduler } from './services/DmxScheduler'

const role = new URLSearchParams(window.location.search).get('role')
const isProjectorRole = role === 'projector'

// Initialize independent DMX engine (main control window only — the projector
// window renders its own visual and must not run a second scheduler instance)
if (!isProjectorRole) {
    dmxScheduler.start()
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isProjectorRole ? <ProjectorApp /> : <App />}
    </React.StrictMode>
)
