// ============================================================================
// BeamStudio DMX Worker Thread
// Responsabilidad: Bucle de transmisión de alta precisión (D2XX)
// ============================================================================

const { parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

const { sharedBuffer, serialNumber, settings } = workerData;
const dmxArray = new Uint8Array(sharedBuffer);

// Buffer estático de transmisión (tamaño adaptado a 33 para hardware limitado)
const txLen = settings?.transmitLength || 33;
const txBuffer = Buffer.alloc(txLen, 0);

let dmxMs = Math.round(1000 / (settings?.dmxHz || 44));
let isRunning = true;

async function startWorker() {
    let device = null;
    try {
        const rawFTDI = await import('ftdi-d2xx');
        const FTDI = rawFTDI.default || rawFTDI;


        device = await FTDI.openDevice(serialNumber);

        // Configuración inicial idéntica al driver "Golden"
        await device.setBaudRate(250000);
        await device.setDataCharacteristics(8, 2, 0);
        await device.setFlowControl(0, 0, 0);
        await device.setLatencyTimer(2);
        await device.purge(1 | 2);

        parentPort.postMessage({ type: 'status', status: 'connected' });

        async function transmitLoop() {
            if (!isRunning) {
                if (device) await device.close();
                return;
            }

            const startTime = performance.now();

            try {
                // 1. Limpieza rápida antes de empezar (Golden logic)
                await device.purge(1 | 2);

                // 2. Hardware BREAK (2.0ms usando Spin-lock para máxima precisión)
                await device.setBreakOn();
                const breakStart = performance.now();
                while (performance.now() - breakStart < 2.0);

                // 3. Mark After Break (MAB) (0.2ms Spin-lock)
                await device.setBreakOff();
                const mabStart = performance.now();
                while (performance.now() - mabStart < 0.2);

                // 4. Preparar frame (Cero concatenaciones, solo copia)
                // SC (0x00) ya está en txBuffer[0] por Buffer.alloc
                for (let i = 0; i < txLen - 1; i++) {
                    txBuffer[i + 1] = dmxArray[i + 1];
                }

                // 5. Envío físico
                await device.write(txBuffer);

            } catch (err) {
                parentPort.postMessage({ type: 'error', error: err.message });
            }

            // 6. Pacing dinámico para mantener dmxHz constante
            const elapsed = performance.now() - startTime;
            const delay = Math.max(0, dmxMs - elapsed);

            // Jitter reduction para el parpadeo en Windows
            if (delay <= 2) {
                setImmediate(transmitLoop);
            } else {
                setTimeout(transmitLoop, delay - 1);
            }
        }

        transmitLoop();

    } catch (err) {
        parentPort.postMessage({ type: 'error', error: `Init Failed: ${err.message}` });
    }
}

// Escuchar comandos del hilo principal
parentPort.on('message', (msg) => {
    if (msg.type === 'stop') {
        isRunning = false;
    }
    if (msg.type === 'updateSettings') {
        if (msg.dmxHz) dmxMs = Math.round(1000 / msg.dmxHz);

    }
});

startWorker();
