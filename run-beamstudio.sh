#!/bin/bash
# Wrapper script para ejecutar BeamStudio AppImage con sandbox configurado

APPIMAGE="/home/fran/projects/BeamStudio/dist/BeamStudio-1.0.0.AppImage"

# Crear directorio temporal para el mount
TMPDIR=$(mktemp -d)
export TMPDIR

# Ejecutar AppImage con --no-sandbox (necesario en algunos sistemas)
exec "$APPIMAGE" --no-sandbox "$@"
