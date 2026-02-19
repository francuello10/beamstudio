# 🚀 Guía de Release para BeamStudio

## Crear un Release Manual

### 1. Preparar el Release

```bash
# Asegúrate de estar en la rama main/master
git checkout main
git pull origin main

# Actualiza la versión en package.json si es necesario
# npm version patch|minor|major  # O edita manualmente

# Build y genera instaladores
npm run build
npm run dist
```

### 2. Crear Tag y Push

```bash
# Crear tag (ejemplo: v1.0.0)
git tag -a v1.0.0 -m "Release v1.0.0: Descripción del release"
git push origin v1.0.0
```

### 3. Crear Release en GitHub

1. Ve a: `https://github.com/francuello10/beamstudio/releases/new`
2. Selecciona el tag que acabas de crear (v1.0.0)
3. Título: `BeamStudio v1.0.0`
4. Descripción: Usa el template abajo
5. Sube los archivos desde `dist/`:
   - `beamstudio_1.0.0_amd64.deb`
   - `BeamStudio-1.0.0.AppImage`
   - `BeamStudio Setup 1.0.0.exe` (si está disponible)
6. Marca como "Latest release" si es la versión más reciente
7. Publica el release

### Template de Descripción

```markdown
## 🎉 BeamStudio v1.0.0

### ✨ Nuevas Características
- Feature 1
- Feature 2

### 🐛 Correcciones
- Fix 1
- Fix 2

### 📦 Instalación

**Ubuntu/Debian:**
```bash
sudo dpkg -i beamstudio_1.0.0_amd64.deb
sudo apt-get install -f
```

**AppImage:**
```bash
chmod +x BeamStudio-1.0.0.AppImage
./BeamStudio-1.0.0.AppImage --no-sandbox
```

**Windows:**
Ejecuta el instalador `.exe` descargado.

### 📝 Notas
- Requiere Node.js 20+
- Compatible con Ubuntu 24.04+ y Windows 11+
```

## Release Automático con GitHub Actions

Si configuraste el workflow (`.github/workflows/release.yml`), al hacer push de un tag:

```bash
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

GitHub Actions automáticamente:
1. Build en Ubuntu y Windows
2. Genera los instaladores
3. Crea el release
4. Sube los archivos

Solo necesitas editar la descripción del release en GitHub.

## Buenas Prácticas

✅ **SÍ hacer:**
- Usar versionado semántico (v1.0.0, v1.0.1, v1.1.0, v2.0.0)
- Incluir changelog en la descripción
- Probar los instaladores antes de publicar
- Marcar releases importantes como "Latest"

❌ **NO hacer:**
- Subir instaladores directamente al repo
- Usar tags sin el prefijo "v"
- Publicar releases sin probar
- Subir archivos >100MB directamente a GitHub (usar releases)
