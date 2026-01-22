# 🛠️ BeamStudio - Developer Documentation (AI/Dev Focus)

**Repo:** [github.com/francuello10/beamstudio](https://github.com/francuello10/beamstudio)  
**Main Engine:** FTDI D2XX Direct Driver (Ultra-Low Latency)
**Author:** Fran Cuello (@francuello10)

Este documento proporciona una visión técnica de la arquitectura de BeamStudio, destinada a desarrolladores y asistentes de IA.

---

## 🏗️ Arquitectura y Stack Tecnológico

BeamStudio es una aplicación **Electron** de alto rendimiento construida con **React** y **Vite**, optimizada para el control DMX de baja latencia.

### Core Tecnológico
*   **Electron:** Shell multiplataforma.
*   **Vite:** Herramienta de construcción y servidor de desarrollo ultra-rápido.
*   **React 19:** Biblioteca para la interfaz de usuario.
*   **Vanilla CSS + Glassmorphism:** Estética moderna premium sin dependencias pesadas de CSS.
*   **ftdi-d2xx:** Driver de comunicación directa por hardware con chips FTDI (el corazón de la app).
*   **dmxnet:** Implementación de Art-Net para compatibilidad con puentes externos (como QLC+).

---

## 📡 Implementación DMX y Flujo de Datos

### Motor de Transmisión (Main Process)
El archivo `src/main/index.js` gestiona el bucle de transmisión DMX. Hemos migrado de una comunicación serial estándar a **D2XX Direct**, lo que nos permite:
*   Bucle de alta precisión con un **MAB (Mark After Break)** calibrado por hardware.
*   Latencia inferior a 2ms.
*   Uso de un buffer de 512 canales con **Cero-Copia** de memoria durante la transmisión.

### Integración con Google Gemini (AI)
La generación de escenas por IA se realiza a través de un IPC handler en el proceso principal:
*   El Renderer envía prompts vía `window.ai.generate()`.
*   El Main Process ejecuta las llamadas a la API de `@google/generative-ai` con `apiVersion: 'v1beta'` para compatibilidad con modelos experimentales como Gemini 2.0 Flash.
*   La respuesta JSON se parsea en el Renderer para crear escenas dinámicas o presets de color.

### Flujo de Datos de Usuario
1.  **Interacción:** El Renderer (React) llama a `window.dmx.setChannelAsync()` (unidireccional para máximo performance en faders).
2.  **IPC Asíncrono:** Mensaje enviado al Main Process vía `ipcRenderer.send`.
3.  **Estado Global:** El Main process actualiza el array `dmxState.channels`.
4.  **Bucle de Sincronización:** Un intervalo de UI dedicado emite `dmx:colorsUpdated` solo cuando detecta cambios reales, optimizando el uso de la CPU.

---

## 🎨 Diseño y Estética
*   **CSS Puro:** Hemos eliminado Tailwind para reducir el overhead y tener control total sobre las variables de diseño.
*   **Dual Theme:** Sistema de variables CSS (`:root` y `.light`) para gestionar los modos Dark y Light de forma reactiva.
*   **Precisión Visual:** El simulador de barras LED del frontend recibe el estado directo del driver DMX para una previsualización 1:1.

---

## 📂 Estructura del Proyecto
*   `src/main/index.js`: Lógica del driver D2XX, Art-Net y ciclo de vida de Electron.
*   `src/preload/index.js`: Puente de seguridad que expone las APIs de DMX al frontend.
*   `src/renderer/src/App.jsx`: UI principal, gestión de estado global y componentes de las páginas.
*   `src/renderer/src/index.css`: Sistema de diseño basado en variables y componentes Vanilla CSS.

---

## 🛠️ Scripts de Desarrollo
*   `npm run dev`: Inicia el servidor de desarrollo Vite y Electron.
*   `npm run build`: Prepara la aplicación para producción.
*   `npm run dist`: Genera los instaladores finales (`.exe`, `.deb`, `.AppImage`) en la carpeta `dist/`.

---

*BeamStudio: Fusionando la estabilidad del hardware industrial con la estética web moderna.*
