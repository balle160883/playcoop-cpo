# PlayCoop Backend API & Panel CMS (Caja Popular Oblatos)

Sistema Backend moderno desarrollado en **Node.js, Express y TypeScript** con base de datos **PostgreSQL**, diseñado para desplegarse automáticamente en **Dokploy**.

---

## 🌟 Características Principales

1. **Sustitución de PHP/MySQL por PostgreSQL**:
   - Conexión a PostgreSQL en Dokploy con pool seguro y consultas parametrizadas (Cero SQL Injection).
2. **Panel Web CMS Integrado (Roles RBAC)**:
   - **Mercadotecnia:** Subida de videos MP4 para las cápsulas de la app, cambio de banners y redacción de trivias de RachaCoop sin tocar código.
   - **Administrador:** Control total del sistema y usuarios.
3. **API REST para la App Móvil**:
   - Autenticación con JWT (JSON Web Tokens).
   - Endpoints para trivias, racha, puntuaciones del juego de la alcancía y eventos cooperativos.
4. **Despliegue Nativo en Dokploy**:
   - Incluye `Dockerfile` multi-stage optimizado para compilarse y ejecutarse como servicio en Dokploy directamente desde GitHub.

---

## 🔐 Credenciales Iniciales del Panel Web CMS

Al ingresar a la URL del backend en el navegador, se abrirá el panel administrativo:

| Rol | Correo Electrónico | Contraseña Inicial |
| :--- | :--- | :--- |
| **Administrador** | `admin@playcoop.com.mx` | `AdminPlaycoop2026!` |
| **Mercadotecnia** | `mercadotecnia@playcoop.com.mx` | `MarketingCPO2026!` |

---

## 🛠️ Configuración en Dokploy

### Paso 1: Crear la Aplicación en Dokploy
1. En tu panel de Dokploy, entra al proyecto **Playcoop**.
2. Haz clic en **Create Application** y selecciona **GitHub Repository**.
3. Selecciona el repositorio: `balle160883/playcoop-cpo` y rama `main`.
4. En **Build Type**, selecciona **Dockerfile**.

### Paso 2: Variables de Entorno en Dokploy
En la pestaña **Environment** de tu aplicación en Dokploy, agrega:

```env
PORT=3000
DB_HOST=playcoop-playcoop-wt3ftv
DB_PORT=5432
DB_NAME=playcoop-cpo
DB_USER=cpo-dev1
DB_PASSWORD=Seguridad2028#
JWT_SECRET=PlayCoopSecretKey2026_Oblatos_CPO_Secure!
JWT_EXPIRES_IN=7d
NODE_ENV=production
```

> **Nota de Red Interna Dokploy:** Al estar en el mismo Dokploy, la conexión a la base de datos se realiza a través de la red interna ultra rápida usando `DB_HOST=playcoop-playcoop-wt3ftv` y `DB_PORT=5432`.

---

## 📡 Endpoints de la API REST

### Autenticación (`/api/auth`)
* `POST /api/auth/login`: Inicio de sesión (devuelve JWT token).
* `POST /api/auth/register`: Registro de socios desde la app.
* `GET /api/auth/me`: Perfil del usuario autenticado.

### Multimedia y Banners (`/api/media`)
* `GET /api/media`: Lista de videos y banners activos (App y CMS).
* `POST /api/media/upload`: Subir video o imagen (Requiere rol Marketing/Admin).
* `DELETE /api/media/:id`: Desactivar recurso de la app.

### Trivias y RachaCoop (`/api/trivias`)
* `GET /api/trivias`: Preguntas activas de educación financiera.
* `POST /api/trivias/verify`: Validar respuesta y sumar racha/monedas al socio.
* `POST /api/trivias`: Crear nueva pregunta (Marketing/Admin).

### Gamificación (`/api/game`)
* `POST /api/game/score`: Registrar partida del juego de la alcancía.
* `GET /api/game/ranking`: Tabla de clasificación global (Top 10).

### Monitoreo (`/api/health`)
* `GET /api/health`: Estado del servicio y verificación de conexión a PostgreSQL.
