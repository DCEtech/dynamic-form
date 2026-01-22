# 🚀 Guía de Instalación Rápida

## Sistema de Formularios Dinámicos para Clientes

### ⚡ Instalación Express (5 minutos)

#### **Paso 1: Preparar el Entorno**
```bash
# Verificar Python 3.11+
python3.11 --version

# Descargar el proyecto
# (descomprimir en carpeta deseada)
cd formulario-clientes
```

#### **Paso 2: Configurar Entorno Virtual**
```bash
# Crear entorno virtual
python3.11 -m venv venv

# Activar entorno virtual
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
```

#### **Paso 3: Instalar Dependencias**
```bash
# Instalar paquetes requeridos
pip install -r requirements.txt
```

#### **Paso 4: Inicializar Base de Datos**
```bash
# Ejecuta el servicio de MySQL en el docker-compose.yml
docker compose up
```

#### **Configuración Variables de Entorno para subida de archivos al Cloud via WebDAV**
```bash
# En la raiz del proyecto crea un nuevo archivo .env
# Una vez el archivo creado, dentro configurar las siguientes variables de entorno:
NEXTCLOUD_URL=https://cloud.ssolid360.com/remote.php/dav/files
NEXTCLOUD_USER={$TU USUARIO DE ACCESSO A LA NUBE DE SSOLID}
NEXTCLOUD_PASSWORD={$TU CONTRASEÑA}
NEXTCLOUD_PUBLIC_BASE=https://cloud.ssolid360.com/index.php/apps/files/files/?dir=/
# guarda el archivo
```

#### **Paso 6: Ejecutar Aplicación**
```bash
# Iniciar servidor de desarrollo
python app.py
```

#### **Paso 7: Acceder al Sistema**
- Abrir navegador en: **http://localhost:5000**
- ¡Listo! El sistema está funcionando

---


## ✅ Checklist de Instalación

- [ ] Python 3.11+ instalado
- [ ] Proyecto descargado y descomprimido
- [ ] Entorno virtual creado y activado
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Base de datos inicializada (`docker compose up`)
- [ ] Servidor iniciado (`python app.py`)
- [ ] Navegador abierto en `http://localhost:5000`
- [ ] Página principal carga correctamente
- [ ] Formulario de cliente funciona

---

**¡Sistema listo para usar! 🎉**

