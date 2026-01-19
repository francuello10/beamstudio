# ⚡ BeamStudio - Control DMX Aesthetic

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/francuello10/beamstudio)
[![QLC+ Official](https://img.shields.io/badge/QLC+-Official-green)](https://www.qlcplus.org/)

BeamStudio es una interfaz moderna y amigable diseñada para controlar sistemas de iluminación DMX512. Está optimizada para setups donde la estética y la facilidad de uso son prioridad, permitiendo gestionar barras LED y otros equipos con un solo clic.

---

## 🌟 Introducción — ¿Qué es DMX y qué podés hacer?

Este sistema se basa en **DMX512**, el estándar profesional para shows y escenarios. Con BeamStudio, podés llevar ese control "pro" a tu setup hogareño o estudio.

### ¿Qué es DMX512?
Es un protocolo que envía "órdenes" a tus luces (colores, intensidad, efectos). Tu PC genera estas órdenes, que viajan por una interfaz física hacia las barras LED.

### ¿Qué es una controladora DMX?
Es el "cerebro". En este setup, la controladora es:
1. **PC (Windows/Linux)** + **BeamStudio**.
2. **Interfaz Física:** KMTronic USB → DMX.
3. **Puente Opcional:** QLC+ configurado con Art-Net.

---

## 🛠️ Hardware y Configuración

### 1. Equipos Soportados
* **Interfaz:** KMTronic USB DMX512 (Chip FTDI).
* **Luces:** Barras LED American Pro (específicamente StickTec 1019).
* **Conexión:** Cable XLR de 3 pines en cadena (Daisy Chain).

### 2. Modos de las Barras (Display)
Para que BeamStudio tome el control total, las barras deben estar en:
* **Modo:** `dXXX` (ej. `d001`).
* **Personalidad:** `p6` (Modo completo de 7 canales).

### 3. Direccionamiento Recomendado (Addressing)
Para controlar 3 barras de forma independiente sin que se "pisen":
* **Barra 1:** Address `d001` (Canales 1-7).
* **Barra 2:** Address `d008` (Canales 8-14).
* **Barra 3:** Address `d015` (Canales 15-21).

---

## 🚀 Guía de Uso Rápido

### ¿Cómo funciona el "puente" Art-Net?
BeamStudio está diseñado para trabajar "de la mano" con **QLC+**.
1. **BeamStudio** genera la señal estética y fácil de usar.
2. Envía esa señal vía **Art-Net** (red local).
3. **QLC+** recibe el Art-Net y lo entrega a la interfaz USB KMTronic.
*Esto te permite tener lo mejor de los dos mundos: la potencia técnica de QLC+ y la interfaz moderna de BeamStudio.*

### Características Principales
*   **Mixer UI Pro:** Control total de RGB, Dimmer, Strobo y Programas con botones de **Reset a 0** individuales por canal.
*   **Intense Flash:** Botón dedicado para ráfagas de luz blanca estroboscópica al 100% de intensidad (1.5s) con restauración automática de estado.
*   **Color Wheel:** Selector circular "donut" de alta precisión con vista previa en tiempo real.
*   **Latencia Ultra-Baja:** Motor DMX optimizado a **44Hz** con IPC asíncrono, logrando una respuesta instantánea comparable a software profesional como QLC+ o FreeStyler.
*   **Dual Theme:** Interfaz estética premium con modos **Dark** y **Light** totalmente refinados y de alto contraste.
*   **Dynamic Scenes:** Efectos generados por software (Vibe, Aurora, Sunset).
*   **Ambilight:** Sincroniza las luces con el contenido de tu pantalla.
*   **Audio Reactive:** Luces que bailan al ritmo de la música analizando el espectro de audio.

---

## 💻 Instalación y Requisitos
* **OS:** Windows 11 (Recomendado) / Linux.
* **Drivers:** Drivers FTDI instalados para la interfaz KMTronic.
* **Red:** Art-Net configurado en el puerto `6454` (por defecto).

### Modos de Instalación
*   **Windows:** Installer nativo `.exe`.
*   **Linux:** Paquete `.deb` o `.AppImage`.
*   **Dashboard "Always On":** [Ver guía de Kiosk para Linux](docs/LINUX_KIOSK.md).

---

## 🔗 Recursos útiles
*   **Repositorio Oficial:** [GitHub - francuello10/beamstudio](https://github.com/francuello10/beamstudio)
*   **Web Oficial QLC+:** [qlcplus.org](https://www.qlcplus.org/)
*   **Soporte:** Abre un *Issue* en el repositorio para reportar bugs o mejoras.

---

*Desarrollado con ❤️ para setups aesthetic.*
