#!/bin/bash
# Script para instalar Wine y generar instalador de Windows

set -e

echo "🍷 Instalando Wine para generar instalador de Windows..."
echo ""

# Instalar Wine
sudo apt-get update
sudo apt-get install -y wine64 wine32

# Configurar Wine (primera vez)
winecfg 2>/dev/null || echo "Wine configurado"

echo ""
echo "🔨 Generando instalador de Windows..."
npm run build
npx electron-builder --win --x64

echo ""
echo "✅ Instalador de Windows generado!"
ls -lh dist/*.exe 2>/dev/null || echo "Verifica dist/ para el archivo .exe"
