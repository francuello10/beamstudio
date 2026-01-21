# Configuración de BeamStudio en Windows 11 (DMX USB)

BeamStudio ahora utiliza un motor de comunicación de alta precisión (**D2XX**) que es mucho más estable y rápido que los métodos tradicionales. Lo mejor es que la configuración es increíblemente sencilla.

## 🚀 Guía de Instalación Rápida

Para empezar a controlar tus luces, solo necesitas seguir estos dos pasos:

### 1. Instalar el Driver de FTDI
BeamStudio se comunica directamente con el chip de tu interfaz. Para que Windows lo reconozca correctamente:
1. Ve a la página oficial de FTDI: [FTDI Drivers](https://ftdichip.com/drivers/vcp-drivers/)
2. Descarga el **"setup executable"** en la sección de Windows (columna de la derecha en la tabla).
3. Ejecútalo e instálalo. Esto permitirá que la app hable directamente con el hardware sin latencia.

*Nota: No necesitas activar el modo VCP ni configurar puertos COM. La app detectará el chip automáticamente.*

### 2. Instalar BeamStudio
1. Descarga el instalador `.exe` de BeamStudio desde la sección de **Releases** en GitHub.
2. Ejecuta el instalador.
3. Abre la aplicación.

## 💡 Cómo empezar a usarlo
1. Conecta tu interfaz DMX al puerto USB.
2. Abre BeamStudio y ve a la pestaña **System**.
3. Asegúrate de que **Direct USB** esté seleccionado.
4. En la lista de dispositivos deberías ver tu interfaz FTDI (marcada con una estrella ⭐).
5. Haz clic en **ACTIVATE HIGH PRECISION DMX**.

¡Y ya está! Dos clics y ya tienes el control total de tus luces con precisión profesional.
