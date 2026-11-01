# Pantalla Focus

Aplicación web educativa de autoobservación de hábitos digitales, cuatro tareas cognitivas orientativas, entorno 3D y tutor de estudio FocusIA.

## Estado y alcance

Esta entrega contiene una aplicación funcional de frontend con persistencia local y un backend Node.js para conectar FocusIA con la API de OpenAI.

- **Implementado en el cliente:** navegación, diario editable con una entrada por fecha, experimento descriptivo de siete días, gráficas basadas en datos guardados, exportación JSON/CSV, cuatro pruebas tradicionales, tarjetas de estudio locales y una escena 3D Three.js con movimiento, cámara, objetivos y controles táctiles.
- **Backend implementado, pendiente de configuración:** endpoint `/api/focusia`, carga de imágenes JPG/PNG/WEBP, validación, límite de tamaño, rate limit, CORS, Helmet y uso de `OPENAI_API_KEY` solo en servidor.
- **No incluido:** cuentas, sincronización entre dispositivos, medición automática del uso real de pantalla, logotipo institucional (no se ha proporcionado el archivo), PDF, analítica clínica ni despliegue.
- **No probado en dispositivos físicos:** los controles móviles están implementados, pero deben validarse en iPhone y Android reales antes de publicar.

Los resultados de las tareas son orientativos y no son diagnósticos ni pruebas clínicas validadas. Los registros se guardan en el navegador y dependen del dispositivo/perfil utilizado.

## Ejecutar localmente

Necesitas Node.js 20 o superior y conexión a Internet para cargar Three.js desde CDN.

```bash
npm install
cp .env.example .env
npm start
```

Abre `http://localhost:3000`. En esta versión el servidor API no sirve el frontend; para probarlo, sirve la carpeta con un servidor estático en el puerto permitido, o añade un servidor estático a Express. La forma más sencilla para desarrollo es:

```bash
npx http-server . -p 8080
```

En ese caso, cambia `ALLOWED_ORIGINS=http://localhost:8080` en `.env`, reinicia el backend y abre `http://localhost:8080`.

En Preferencias (⚙), introduce `http://localhost:3000` como URL del backend.

## Conectar FocusIA

1. Crea una clave en la plataforma de API de OpenAI.
2. Copia `.env.example` a `.env`.
3. Añade la clave a `OPENAI_API_KEY`. Nunca la pegues en `app.js`, `index.html`, GitHub Pages ni en el navegador.
4. Configura `OPENAI_MODEL` con un modelo habilitado para tu proyecto y compatible con la API Responses y entrada de imagen.
5. Configura `ALLOWED_ORIGINS` con el origen exacto de tu frontend, sin comodines.
6. Ejecuta `npm install && npm start`.
7. En Preferencias de Pantalla Focus, introduce la URL pública del backend.

La API puede generar costes independientes. El backend limita las peticiones por IP a 12 por minuto y las imágenes a 5 MB. Para producción añade autenticación o un control de abuso apropiado para tu caso de uso, monitorización y límites de gasto en la cuenta API. No publiques un backend sin controles adecuados.

## Publicación

### Frontend en GitHub Pages
Publica `index.html`, `styles.css`, `app.js` y `games3d.js` en la raíz de la rama/carpeta configurada para Pages. El motor 3D se descarga bajo demanda desde CDN. Configura la URL del backend en Preferencias.

### Backend Node
Despliega `server.mjs` y `package.json` en un proveedor que ejecute Node.js. Añade las variables de entorno en el panel privado del proveedor. Configura `ALLOWED_ORIGINS` con tu dominio de GitHub Pages (por ejemplo, `https://usuario.github.io`) y `OPENAI_API_KEY` en el panel de secretos. Usa HTTPS.

## Estructura

- `index.html`: estructura y secciones.
- `styles.css`: diseño adaptable y accesibilidad visual.
- `app.js`: navegación, diario, estadísticas, pruebas, tarjetas, FocusIA y persistencia.
- `games3d.js`: motor Three.js cargado bajo demanda.
- `server.mjs`: backend seguro de FocusIA.
- `.env.example`: plantilla de configuración.
- `package.json`: dependencias y scripts.

## Almacenamiento y privacidad

La información se guarda en `localStorage` bajo la clave `pantalla-focus-v1`. Exporta JSON periódicamente si quieres una copia. Borrar los datos del navegador, cambiar de navegador o de dispositivo puede hacer que pierdas el historial. No se guardan las imágenes adjuntas de forma permanente. Las conversaciones se guardan localmente solo como actividad resumida; la consulta se transmite al backend configurado.

## Comprobaciones realizadas en esta entrega

- Archivos y estructura generados.
- Se han añadido validaciones básicas de campos y tamaño de imagen.
- Se ha implementado persistencia mediante localStorage.
- No se ha ejecutado una batería de pruebas automatizadas de navegador ni se ha desplegado el backend.
- No se declara como verificado ningún flujo de API sin una clave y un modelo configurados.
- El juego requiere WebGL, carga de Three.js desde CDN y una prueba en navegador real para validar rendimiento y controles.

## Limitaciones conocidas que conviene revisar antes de producción

- El experimento cuenta siete fechas únicas de diario; no impone una semana calendario fija.
- La prueba de atención presenta 40 estímulos; los tiempos y la secuencia son tareas de práctica, no baremos.
- Las pruebas de memoria terminan al primer error o al alcanzar el límite de niveles.
- El modo 3D de esta primera entrega incluye escenario explorable, disparo energético y objetivos. Los modos 3D avanzados de memoria numérica, palabras y secuencia todavía no están implementados como experiencias completas.
- El backend usa la API Responses. Verifica en la documentación oficial que el modelo configurado esté habilitado para tu cuenta y admita imágenes.
- El logo del Institut Can Peixauet se debe añadir cuando se proporcione el archivo original.
