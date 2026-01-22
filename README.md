# ⚡ BeamStudio - Control DMX Aesthetic

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/francuello10/beamstudio)
[![DMX Precision](https://img.shields.io/badge/DMX-Ultra--Precision-red)](https://github.com/francuello10/beamstudio)

**BeamStudio** es una interfaz moderna, potente y de alta fidelidad diseñada para el control total de sistemas de iluminación DMX512. Creada por **Fran Cuello**, está optimizada para setups donde la estética, la velocidad de respuesta y la facilidad de uso son prioridad.

---

## 🌟 ¿Qué podés hacer con BeamStudio?

A diferencia de los softwares tradicionales toscos y complicados, BeamStudio te permite transformar tu espacio con un solo clic:

*   **Mixer Pro:** Control total de RGB, Dimmer, Strobo y Funciones Especiales. Incluye botones "MAX" para cada canal y bloqueo de selección para evitar errores en vivo.
*   **Motor D2XX de Alta Precisión:** Comunicación directa con el hardware sin intermediarios. Latencia ultra-baja (<2ms) para una respuesta instantánea.
*   **Ambilight TV:** Sincroniza tus luces con lo que pasa en tu monitor, creando una experiencia inmersiva para gaming o cine.
*   **Audio Reactive:** Tus luces bailan al ritmo de la música analizando el espectro de audio en tiempo real. El Live Output ahora muestra flashes en los golpes de bajo.
*   **Escenas Dinámicas:** Efectos fluidos (Vibe, Aurora, Rainbow, Fire) que mutan automáticamente, con Master Dimmer para control de brillo global.
*   **AI Scene Generation:** Crea escenas de iluminación personalizadas describiendo el ambiente que querés. Powered by Google Gemini 2.0 Flash.

---

## 🚀 Instalación Hiper-Simplificada (Windows)

Ahora configurar tus luces es más fácil que nunca:

1.  **Instalá el Driver FTDI:** Descargá el ejecutable oficial de [FTDI Drivers](https://ftdichip.com/drivers/vcp-drivers/) e instalalo.
2.  **Instalá BeamStudio:** Bajá el `.exe` desde la sección de *Releases* e instalalo.
3.  **Encendé la Magia:** Conectá tu interfaz, abrí la app, andá a **System** y hacé clic en **ACTIVATE HIGH PRECISION DMX**.

*¡No más configuraciones complejas de puertos COM o puentes externos! (Aunque seguimos soportando Art-Net si preferís usar QLC+).*

---

## 🛠️ Hardware Recomendado
*   **Interfaz:** KMTronic USB DMX512 (o cualquier interfaz basada en chips FTDI).
*   **Luces:** Barras LED o focos DMX. Recomendamos las American Pro (StickTec 1019).
*   **Direccionamiento (P6 Mode):**
    *   **Barra 1:** Canales 1-7 (Start `d001`).
    *   **Barra 2:** Canales 8-14 (Start `d008`).
    *   **Barra 3:** Canales 15-21 (Start `d015`).

---

## 💻 Desarrollo y Contribución

Si sos desarrollador y querés jugar con el código:
1. Cloná el repo: `git clone https://github.com/francuello10/beamstudio.git`
2. Instalá dependencias: `npm install`
3. Ejecutá en dev: `npm run dev`

---

## 🔗 Links Útiles
*   **Autor:** [Fran Cuello](https://github.com/francuello10)
*   **Repositorio:** [BeamStudio en GitHub](https://github.com/francuello10/beamstudio)
*   **Guía Detallada:** [Configuración en Windows](docs/WINDOWS_SETUP.md)

---

*Desarrollado con ❤️ por Fran Cuello para setups aesthetic.*
