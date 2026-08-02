# BS-000 — Baseline evidence

**Started at:** 2026-08-02  
**Branch:** `chore/bs-000-baseline-diagnostics`  
**Commit base:** `c1cb1ba`

## What was verified

- `npm ci` completed successfully.
- `npm run build` completed successfully.
- The environment is Ubuntu 24.04.4 LTS.
- Node is `v22.23.2`.
- npm is `10.9.8`.
- The session is running on Wayland (`WAYLAND_DISPLAY=wayland-0`) with `DISPLAY=:0`.
- PipeWire, PipeWire PulseAudio, and WirePlumber are running in the user session.
- USB inventory shows an FTDI device present (`0403:6001`), which is relevant for DMX hardware validation later in `BS-001`.

## Files in this folder

- `session.env` — branch, date, user, and commit used for the capture.
- `baseline-system.txt` — git, OS, Node/npm, install, and build results.
- `hardware-inventory.txt` — display session, PCI, USB, and PipeWire status.
- `npm-ci.log` — raw install log.
- `build.log` — raw build log.
- `check.log` — first successful run of `npm run check`.
- `doctor.json` — first successful run of `npm run doctor`.
- `build-after-bs000-slice.log` — build verification after the first BS-000 code slice.
- `dev-run-connected.log` — user-provided successful `yarn dev` session with DMX USB auto-connect on Linux.

## Findings so far

1. Build baseline is healthy enough to continue M0 work.
2. `npm ci` reports **26 vulnerabilities** (`2 low`, `2 moderate`, `21 high`, `1 critical`), but BS-000 does not treat dependency cleanup as an automatic fix target.
3. `pactl list short sources` and `pactl list short sinks` returned no entries in this capture, even though PipeWire services are active. This is important and should be rechecked during the audio-source work in `BS-002`.
4. The remaining GUI/manual checks were explicitly waived by the owner on 2026-08-02 to keep momentum and continue directly with BS-001 in a solo-operated repository.
5. First BS-000 implementation slice already landed in the branch:
   - `npm run check`
   - `npm run doctor`
   - global `uncaughtException` / `unhandledRejection` logging in main
   - safe preload listener cleanup via `removeListener`
6. A real desktop `yarn dev` run was captured with successful Linux DMX auto-connect on `/dev/ttyUSB0`, including worker start and serial open at 250k.

## Next step

BS-000 is considered closed with owner-approved manual QA waiver. The next active task is `BS-001` (DMX regression and repair).
