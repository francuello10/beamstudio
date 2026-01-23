// ============================================================================
// BeamStudio Linux Serial Worker Thread
// Responsibility: High-precision DMX transmission via /dev/ttyUSB0 (Kernel Driver)
// ============================================================================

const { parentPort, workerData } = require('worker_threads');
const { SerialPort } = require('serialport');
const { performance } = require('perf_hooks');

// Import Hardware Constants (simulated import since we can't easily require ES modules in CJS worker without transpilation setup)
// We duplicate the constants here to ensure self-contained stability, matching `src/shared/hardware-specs.js`
const SERIAL_PROTOCOL = {
    BREAK: 2.0, // Mark Break
    MAB: 0.2,   // Mark After Break
};

const { sharedBuffer, serialNumber, settings } = workerData;
const dmxArray = new Uint8Array(sharedBuffer);

// Static transmission buffer (33 bytes: 1 Start Code + 32 Channels)
const txBuffer = Buffer.alloc(33, 0);

let dmxMs = Math.round(1000 / (settings?.dmxHz || 44));
let isRunning = true;

async function startWorker() {
    console.log(`[DMX Serial Worker] Opening device: ${serialNumber}`);

    const port = new SerialPort({
        path: serialNumber, // In serialport, 'path' is the device path (e.g., /dev/ttyUSB0)
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
        autoOpen: false
    });

    port.open((err) => {
        if (err) {
            parentPort.postMessage({ type: 'error', error: `Open Failed: ${err.message}` });
            return;
        }

        console.log(`[DMX Serial Worker] Port opened successfully at 250k`);
        parentPort.postMessage({ type: 'status', status: 'connected' });
        transmitLoop();
    });

    function setBreak(enable) {
        return new Promise((resolve, reject) => {
            port.set({ brk: enable }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    function writeData(buffer) {
        return new Promise((resolve, reject) => {
            port.write(buffer, (err) => {
                if (err) reject(err);
                else {
                    port.drain((drainErr) => {
                        if (drainErr) reject(drainErr);
                        else resolve();
                    });
                }
            });
        });
    }

    async function transmitLoop() {
        if (!isRunning) {
            if (port.isOpen) port.close();
            return;
        }

        const startTime = performance.now();

        try {
            // 1. BREAK (2.0ms Spin-lock)
            await setBreak(true);
            const breakStart = performance.now();
            while (performance.now() - breakStart < SERIAL_PROTOCOL.BREAK);

            // 2. MAB (0.2ms Spin-lock)
            await setBreak(false);
            const mabStart = performance.now();
            while (performance.now() - mabStart < SERIAL_PROTOCOL.MAB);

            // 3. Prepare Frame (Copy from shared buffer)
            // txBuffer[0] is always 0x00 (Start Code)
            for (let i = 0; i < 32; i++) {
                txBuffer[i + 1] = dmxArray[i + 1];
            }

            // 4. Send Data
            await writeData(txBuffer);

        } catch (err) {
            parentPort.postMessage({ type: 'error', error: err.message });
        }

        // 5. Dynamic Pacing (Maintain strict Hz)
        const elapsed = performance.now() - startTime;
        const delay = Math.max(1, dmxMs - elapsed);

        // Use setImmediate if delay is very small for tighter loops, else setTimeout
        if (delay < 5) {
            setTimeout(transmitLoop, 1);
        } else {
            setTimeout(transmitLoop, delay);
        }
    }
}

// Listen for messages from main thread
parentPort.on('message', (msg) => {
    if (msg.type === 'stop') {
        isRunning = false;
    }
    if (msg.type === 'updateSettings') {
        if (msg.dmxHz) dmxMs = Math.round(1000 / msg.dmxHz);
    }
});

startWorker();
