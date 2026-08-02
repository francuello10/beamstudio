## 🎉 BeamStudio v1.0.0 - First Production Release

### ✨ Características Principales

- **Control DMX512 Profesional**: Soporte para interfaces USB (FTDI D2XX en Windows, SerialPort en Linux)
- **Arquitectura de Estado Atómico**: Ultra-baja latencia (<2ms) para control de alta fidelidad
- **Escenas Dinámicas**: 20+ escenas pre-programadas (Vibe, Rainbow, Fire, Aurora, etc.)
- **Audio Reactivo**: Análisis espectral 2.1 con modo Deco para sistemas de alta gama
- **Ambilight**: Captura de pantalla en tiempo real con WebGL
- **Fluid Simulation**: Motor Navier-Stokes WebGL2 con presets "Neon Overdrive"
- **AI Procedural Scenes**: Generación de escenas complejas usando Google Gemini 2.0 Flash
- **Console Mixer (GrandMaster)**: Control profesional de atributos con gestión de Fixture Patch
- **Background Execution**: Modo anti-freeze para continuidad cuando la app está minimizada

### 🛠️ Mejoras Técnicas

- Sistema de logging condicional para producción
- ErrorBoundary mejorado con mejor UX
- Workers de alta precisión para transmisión DMX
- Soporte multiplataforma: Windows 11 y Ubuntu 24.04+

### 📦 Instalación

**Ubuntu/Debian (.deb - Recomendado):**
```bash
sudo dpkg -i beamstudio_1.0.0_amd64.deb
sudo apt-get install -f
beamstudio
```

**AppImage (Portátil):**
```bash
chmod +x BeamStudio-1.0.0.AppImage
./BeamStudio-1.0.0.AppImage --no-sandbox
```

**Windows:**
El instalador .exe estará disponible en futuros releases (requiere build en Windows).

### 🔧 Requisitos

- **Hardware**: KMTronic USB DMX512 o cualquier hardware compatible FTDI D2XX
- **Fixtures**: StickTec 1019 (American Pro) o unidades RGB DMX estándar
- **Sistema**: Ubuntu 24.04+ o Windows 11
- **Drivers**: FTDI VCP Drivers instalados

### 📝 Notas

- Primera versión de producción estable
- Código auditado y listo para uso profesional
- Instaladores probados en sistemas limpios

---

*Desarrollado con ❤️ por Fran Cuello para setups de alta fidelidad.*
