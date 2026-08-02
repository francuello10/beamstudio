# Matriz de QA y evidencia

## Convenciones

- **P0:** bloquea el roadmap.
- **P1:** importante para el milestone.
- **P2:** mejora.
- Evidencia recomendada: log, captura, video corto o JSON de diagnóstico.
- Estado inicial: `NOT RUN`.

## A. Instalación y aplicación

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-001 | P0 | `npm ci` desde clon limpio | Sin errores | NOT RUN |
| QA-002 | P0 | `npm run build` | Build completo | NOT RUN |
| QA-003 | P0 | `npm run dev` | Ventana abre sin error fatal | NOT RUN |
| QA-004 | P0 | Cerrar ventana | Proceso termina, sin workers huérfanos | NOT RUN |
| QA-005 | P1 | Minimizar/restaurar | DMX activo continúa y UI se recupera | NOT RUN |
| QA-006 | P1 | Navegar por todas las páginas | Sin errores de consola | NOT RUN |

## B. DMX y fixtures

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-101 | P0 | Detectar KMTronic | Dispositivo listado | NOT RUN |
| QA-102 | P0 | Conectar Linux Serial | Worker conectado | NOT RUN |
| QA-103 | P1 | Fallback Art-Net | Se puede activar sin crash | NOT RUN |
| QA-104 | P0 | RGB fixture 1 | Solo barra d001 responde | NOT RUN |
| QA-105 | P0 | RGB fixture 2 | Solo barra d008 responde | NOT RUN |
| QA-106 | P0 | RGB fixture 3 | Solo barra d015 responde | NOT RUN |
| QA-107 | P0 | Dimmer maestro | Afecta las tres sin alterar color | NOT RUN |
| QA-108 | P1 | Flash | Arranca y restaura estado | NOT RUN |
| QA-109 | P0 | Blackout | Apaga y restaura correctamente | NOT RUN |
| QA-110 | P0 | Dynamic Scene | Arranca sin `CHANNEL_MAP` error | NOT RUN |
| QA-111 | P0 | Detener escena | No queda intervalo activo | NOT RUN |
| QA-112 | P1 | 15 min escena | Sin freeze o pérdida de USB | NOT RUN |

## C. Audio

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-201 | P0 | Enumerar dispositivos | Lista y labels tras permiso | NOT RUN |
| QA-202 | P0 | Seleccionar monitor PipeWire | Spotify/Tidal mueve medidores | NOT RUN |
| QA-203 | P0 | Micrófono muteado | La música sigue detectándose | NOT RUN |
| QA-204 | P0 | Silencio | Valores vuelven cerca de cero | NOT RUN |
| QA-205 | P0 | Kick claro | `bass/transient` responde | NOT RUN |
| QA-206 | P1 | Señal estéreo | L/R se diferencian | NOT RUN |
| QA-207 | P0 | Stop/start repetido x10 | Sin tracks o contexts acumulados | NOT RUN |
| QA-208 | P0 | 60 min playback | Sin excepción, NaN o freeze | NOT RUN |
| QA-209 | P1 | Cambio de fuente | Reconecta o informa error | NOT RUN |

## D. Escenas reactivas

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-301 | P0 | Bass Pulse | Centro sigue kick con decay | NOT RUN |
| QA-302 | P0 | Stereo Flow | Laterales siguen L/R | NOT RUN |
| QA-303 | P0 | Techno Chase | Transientes disparan movimiento | NOT RUN |
| QA-304 | P0 | Ambient Drift | Energía controla intensidad suave | NOT RUN |
| QA-305 | P0 | Silencio | Sin falsos flashes | NOT RUN |
| QA-306 | P1 | Sensibilidad | Cambia respuesta sin código | NOT RUN |
| QA-307 | P0 | Cambiar escena | Solo una salida escribe DMX | NOT RUN |
| QA-308 | P0 | Dimmer | Conserva autoridad en todas | NOT RUN |

## E. Ambilight

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-401 | P0 | Listar/capturar fuente Wayland | Portal/fuente funciona | NOT RUN |
| QA-402 | P0 | Video rojo/verde/azul por zonas | Fixture order correcto | NOT RUN |
| QA-403 | P1 | Mono | Tres barras usan centro | NOT RUN |
| QA-404 | P1 | Audio OFF | Solo imagen modula | NOT RUN |
| QA-405 | P1 | Audio ON | Audio suma sin saturar | NOT RUN |
| QA-406 | P0 | Stop | Stream y DMX se limpian | NOT RUN |
| QA-407 | P1 | 60 min película/video | Sin freeze | NOT RUN |

## F. Fluid y proyector

| ID | Pri | Prueba | Resultado esperado | Estado |
|---|---:|---|---|---|
| QA-501 | P1 | Fluid start/stop | Canvas estable | NOT RUN |
| QA-502 | P1 | Cambio de paleta | Transición limpia | NOT RUN |
| QA-503 | P1 | Audio reactivo | Usa AudioFrame | NOT RUN |
| QA-504 | P1 | 60 min | Sin context loss no gestionado | NOT RUN |
| QA-601 | P1 | Detectar HY300PRO | Display listado | NOT RUN |
| QA-602 | P1 | Fullscreen | Ventana sin UI | NOT RUN |
| QA-603 | P1 | Blackout | Negro inmediato | NOT RUN |
| QA-604 | P1 | Desconectar/reconectar | Error controlado | NOT RUN |

## Formato de evidencia

```md
### QA-XXX

- Fecha:
- Commit:
- OS:
- Hardware:
- Comando/pasos:
- Esperado:
- Resultado:
- Estado: PASS / FAIL / BLOCKED
- Evidencia:
- Notas:
```
