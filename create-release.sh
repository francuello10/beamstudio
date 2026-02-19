#!/bin/bash
# Script para crear release v1.0.0 en GitHub

set -e

echo "🚀 Creando release v1.0.0 para BeamStudio..."
echo ""

# Verificar que los instaladores existan
if [ ! -f "dist/beamstudio_1.0.0_amd64.deb" ]; then
    echo "❌ Error: dist/beamstudio_1.0.0_amd64.deb no encontrado"
    exit 1
fi

if [ ! -f "dist/BeamStudio-1.0.0.AppImage" ]; then
    echo "❌ Error: dist/BeamStudio-1.0.0.AppImage no encontrado"
    exit 1
fi

# Verificar autenticación
if ! gh auth status &>/dev/null; then
    echo "⚠️  No estás autenticado con GitHub CLI"
    echo "Ejecuta: gh auth login"
    exit 1
fi

# Crear release
echo "📦 Subiendo instaladores..."
gh release create v1.0.0 \
    --title "BeamStudio v1.0.0" \
    --notes-file RELEASE_NOTES_v1.0.0.md \
    dist/beamstudio_1.0.0_amd64.deb \
    dist/BeamStudio-1.0.0.AppImage \
    --latest

echo ""
echo "✅ Release creado exitosamente!"
echo "🌐 Visita: https://github.com/francuello10/beamstudio/releases/tag/v1.0.0"
