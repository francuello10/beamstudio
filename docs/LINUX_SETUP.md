# Configuración de BeamStudio en Ubuntu 24.04 (DMX USB)

BeamStudio en Linux está altamente optimizado para baja latencia. Aquí están las mejoras y la configuración necesaria.

## 🚀 Mejoras Implementadas para Linux

1.  **Estabilidad Ultra-Alta (Driver `enttec-open`)**:
    *   A diferencia de otros programas que usan drivers seriales genéricos, BeamStudio ahora implementa nativamente el protocolo **Enttec Open DMX** con control preciso de la señal **BREAK**.
    *   Esto elimina el "flicker" (parpadeo) común en interfaces económicas (FTDI/CH340) en Linux.

2.  **Latencia Mínima**:
    *   Al usar el kernel de Linux directamente a través de `/dev/ttyUSB0`, la latencia es prácticamente cero (~1-5ms), superior incluso a Windows.

3.  **Auto-conexión**:
    *   El sistema buscará automáticamente `/dev/ttyUSB0` (el estándar) y lo seleccionará por defecto.

## ⚠️ Requisito Crítico: Permisos de Usuario

Para que BeamStudio pueda controlar el puerto USB sin `sudo`, tu usuario debe pertenecer al grupo **`dialout`**.

### Cómo configurarlo:

1.  Abre una terminal.
2.  Ejecuta el siguiente comando para añadir tu usuario actual al grupo:

    ```bash
    sudo usermod -a -G dialout $USER
    ```

3.  **IMPORTANTE:** Debes **Cerrar Sesión** (Log Out) y volver a entrar (o reiniciar la computadora) para que el cambio surta efecto.

### Verificación

Después de reiniciar, puedes verificarlo ejecutando:

```bash
groups
```
Deberías ver `dialout` en la lista.

## Solución de Problemas

Si ves el error *"Permission denied"* o *"Access denied"* al intentar conectar:
1.  Verifica el paso anterior.
2.  Asegúrate de que ningún otro software (como QLC+ o ModemManager) esté ocupando el puerto. `ModemManager` a veces interfiere con dispositivos seriales:

    ```bash
    sudo systemctl stop ModemManager
    sudo systemctl disable ModemManager
    ```
