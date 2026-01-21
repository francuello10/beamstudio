# Configuración de BeamStudio en Windows 11 (DMX USB)

Para controlar luces DMX desde BeamStudio en Windows utilizando interfaces USB (como KMtronic, Enttec Open DMX), es crucial configurar correctamente los drivers.

## ⚠️ Requisito Crítico: VCP (Virtual COM Port)

BeamStudio utiliza la librería `serialport` para comunicarse con la interfaz USB. Esto significa que **tu interfaz DMX DEBE aparecer como un puerto COM (ej. `COM3`)** en el Administrador de Dispositivos.

### El Problema Común
Por defecto, Windows puede instalar el driver FTDI en modo **D2XX** (Direct Driver). En este modo, el dispositivo aparece bajo "Universal Serial Bus controllers" como "USB Serial Converter" y **NO** aparece como un puerto COM. Si esto sucede, BeamStudio **NO** detectará el dispositivo.

### La Solución: Activar VCP

Tienes dos formas de solucionar esto:

#### Opción A: Activar VCP en el Administrador de Dispositivos (Rápido)
1. Conecta tu interfaz USB DMX.
2. Abre el **Administrador de Dispositivos** (Click derecho en Inicio -> Administrador de Dispositivos).
3. Busca "Universal Serial Bus controllers" y encuentra "USB Serial Converter" (o similar).
4. Click derecho -> **Propiedades**.
5. Ve a la pestaña **Advanced** (Avanzado).
6. Marca la casilla **Load VCP** (Cargar VCP).
7. Click OK.
8. Desconecta y vuelve a conectar el dispositivo USB.
9. Ahora debería aparecer bajo **"Ports (COM & LPT)"** como "USB Serial Port (COM3)" (o similar).

#### Opción B: Instalar el Driver VCP Ejecutable
1. Ve a la página oficial de FTDI: [FTDI VCP Drivers](https://ftdichip.com/drivers/vcp-drivers/)
2. Descarga el ejecutable "setup executable" para Windows (x64).
3. Ejecútalo e instálalo.
4. Conecta tu dispositivo. Debería ser reconocido automáticamente como puerto COM.

## Configuración en BeamStudio

Una vez que tu dispositivo aparece como puerto COM (ej. `COM3`):

1. Abre BeamStudio.
2. Ve a la pestaña **System**.
3. En "DMX Connection Mode", selecciona **Native USB**.
4. En **Device**, selecciona `COM3` (o el que corresponda). Debería aparecer una estrella ⭐ si es el recomendado.
5. En **Driver**, selecciona:
   - **Enttec Open DMX**: Para interfaces KMtronic, interfaces caseras FTDI, o la Enttec Open original. (Este driver usa la señal BREAK correctamente).
   - **Enttec USB DMX Pro**: Solo si tienes la interfaz "Pro" oficial con microprocesador.
6. Click en **Connect USB Device**.

Si ves "Connected" en verde, ¡estás listo!
