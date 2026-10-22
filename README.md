# Casa 🏠 · calendario familiar compartido

Calendario compartido y cosas de casa para la familia. Es una **PWA**: se instala desde el navegador en Android y en iPhone, sin tiendas de apps y sin pagar la cuenta de Apple Developer. Los cambios llegan al momento al móvil del resto de la familia.

<p align="center">
  <img src="docs/inicio-movil.jpg" alt="Inicio en el móvil" height="520">
  &nbsp;
  <img src="docs/inicio-pantalla.jpg" alt="Inicio en pantalla grande, como panel de pared" height="520">
</p>

<sub>Capturas del modo demo, con datos ficticios.</sub>

**Tecnología:** React + Vite (PWA con service worker) · Firebase Auth, Firestore y Hosting · Web Push (VAPID) enviado desde GitHub Actions · [Open-Meteo](https://open-meteo.com) y [REE](https://www.ree.es/es/apidatos) para el tiempo y la luz.

## Qué tiene

- **Inicio**: cuadro de mando con reloj, el tiempo, «lo próximo» con cuenta atrás, agenda de hoy y mañana, menú de hoy, la semana de un vistazo y tarjetas de compra, tareas, luz, fechas, gastos y notas. **Cada persona elige qué tarjetas ve y en qué orden** (Personalizar inicio). En una tablet u ordenador se ve como un panel de pared.
- **Calendario**: vista de semana y de mes, un color por persona (también para las peques), eventos que se repiten, eventos de varios días y avisos.
- **Compra**: lista compartida en tiempo real, sugerencias de lo que más compráis y varias cosas a la vez separadas por comas.
- **Tareas**: tareas de casa con responsable; las que se repiten vuelven solas al marcarlas.
- **Menú**: comida y cena de cada día; aparecen también en el calendario.
- **Fechas**: cumpleaños (con la edad), ITV, seguros y recibos, con aviso unos días antes.
- **Gastos**: quién ha pagado qué, quién debe a quién y resumen del mes por categorías.
- **Notas**: tablón compartido (wifi de invitados, teléfonos…).
- **Tiempo** ([Open-Meteo](https://open-meteo.com)) y **luz**: precio PVPC por horas ([REE](https://www.ree.es/es/apidatos)) y las horas más baratas para la lavadora.
- **Notificaciones push**: recordatorios de eventos, resumen por la mañana, vencimientos y «Sam ha añadido leche a la compra».

Todo funciona con planes gratuitos: Firebase Spark y GitHub Actions.

---

## Probarla ya (modo demo)

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173 y pulsa **Probar en modo demo**. Los datos de ejemplo se guardan solo en ese navegador. Desde el móvil, en la misma wifi, abre la dirección `Network` que muestra la consola.

---

## Puesta en marcha (una sola vez, unos 30 minutos)

### 1. Crear el proyecto de Firebase

1. Entra en <https://console.firebase.google.com> → **Crear proyecto** (por ejemplo `casa-familia`). Google Analytics no hace falta.
2. **Authentication** → *Comenzar* → *Método de inicio de sesión*: activa **Correo electrónico/contraseña** y **Google**.
3. **Firestore Database** → *Crear base de datos* → ubicación `europe-southwest1 (Madrid)` → modo **producción**.
4. **Configuración del proyecto** (rueda dentada) → *Tus apps* → icono **`</>`** (web) → registra la app «Casa». Copia los valores de `firebaseConfig`.
5. En la carpeta del proyecto, copia `.env.example` como `.env.local` y pega esos valores:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=casa-familia.web.app
   VITE_FIREBASE_PROJECT_ID=casa-familia
   ...
   ```

   > En `AUTH_DOMAIN` pon `TU-PROYECTO.web.app` y no el `firebaseapp.com` que te propone Firebase. Así el login con Google funciona dentro de la app instalada en el iPhone. Mira el paso 3.

### 2. Publicarla (Firebase Hosting, gratis)

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase use --add
```

(elige tu proyecto y ponle el alias `default`)

```bash
npm run deploy
```

El último comando compila la app y sube a la vez la web y las reglas de seguridad de Firestore (`firestore.rules`). La app queda en **https://TU-PROYECTO.web.app**.

### 3. Login con Google en el iPhone (recomendado)

Si solo vais a entrar con email y contraseña, puedes saltarte este paso.

En <https://console.cloud.google.com> (mismo proyecto) → *APIs y servicios* → *Credenciales* → *Web client (auto created by Google Service)* → en **URIs de redireccionamiento autorizados** añade:

```
https://TU-PROYECTO.web.app/__/auth/handler
```

### 4. Instalarla en los móviles

- **Android (Chrome)**: abre la web → menú ⋮ → **Instalar aplicación**.
- **iPhone (Safari)**: abre la web → botón **Compartir** → **Añadir a pantalla de inicio**. Ábrela siempre desde ese icono: las notificaciones solo funcionan así.

### 5. Crear la casa e invitar a tu pareja

1. Entra con tu cuenta y rellena la casa: tu nombre, el de tu pareja, las peques y vuestra ciudad.
2. En **Inicio** (o en **Ajustes → Invitar**) pulsa **Compartir** y envía el enlace por WhatsApp.
3. Tu pareja abre el enlace, crea su cuenta, pulsa **Unirme** y elige quién es.

> El enlace de invitación contiene el identificador secreto de la casa. Compártelo solo con quien quieras que entre.

---

## Notificaciones push (gratis, con GitHub Actions)

Las notificaciones las envía cada 10 minutos un pequeño script ([`notifier/`](notifier/)) que se ejecuta en GitHub Actions. Lee los datos con una cuenta de servicio de Firebase y manda Web Push estándar (VAPID) a los móviles que las hayan activado.

### a) Generar las claves VAPID

```bash
cd notifier && npm install && npm run vapid
```

- Pon la clave **pública** en `.env.local` como `VITE_VAPID_PUBLIC_KEY` y vuelve a publicar con `npm run deploy`.
- Guarda la **privada** para el paso c. No la subas nunca al repositorio.

### b) Cuenta de servicio de Firebase

Consola de Firebase → **Configuración del proyecto** → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un `.json`. Es una contraseña de administrador, así que no la subas al repositorio (el `.gitignore` ya ignora `service-account*.json`).

### c) Repositorio en GitHub y secretos

1. Crea un repositorio en GitHub y sube el proyecto. Es mejor que sea **público**, porque así los minutos de Actions son ilimitados. El código no lleva secretos: la configuración web de Firebase es pública por diseño y los datos están protegidos por las reglas de Firestore.
   Si prefieres un repositorio **privado**, cambia en `.github/workflows/notify.yml` el cron a `*/30` para no pasar de los 2.000 minutos gratis al mes.
2. En el repositorio: **Settings → Secrets and variables → Actions → New repository secret** y crea:

   | Secreto | Valor |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | El contenido **completo** del `.json` del paso b |
   | `VAPID_PUBLIC_KEY` | La clave pública del paso a |
   | `VAPID_PRIVATE_KEY` | La clave privada del paso a |
   | `VAPID_SUBJECT` | `mailto:tu-email@ejemplo.com` |

3. Pestaña **Actions** → activa los workflows → abre **Notificaciones** → **Run workflow** para probarlo.

### d) Activarlas en cada móvil

En la app: **Ajustes → Notificaciones en este móvil**. En el iPhone, primero tiene que estar instalada en la pantalla de inicio.

**Qué avisa:**

- **Eventos**: el aviso que elijas al crearlos (a la hora, 30 minutos antes, el día antes…).
- **Resumen de la mañana** (8:00 por defecto): eventos del día, menú y tareas pendientes.
- **Fechas**: los días de antelación que pongas y también el mismo día.
- **Cambios**: lo que añade el otro (compra, eventos, tareas, notas, gastos…), agrupado.

> El cron de GitHub no es exacto: los avisos pueden llegar con unos minutos de retraso.

---

## Costes

| Servicio | Plan | Para una familia |
|---|---|---|
| Firebase Auth + Firestore + Hosting | Spark (gratis) | Muy por debajo de los límites (50.000 lecturas al día) |
| GitHub Actions | Gratis | Ilimitado en repositorio público |
| Open-Meteo y REE | APIs públicas | Sin clave y sin coste |

---

## Seguridad y privacidad

- En el repositorio **no hay credenciales**. La configuración de Firebase va en `.env.local`, la clave de la cuenta de servicio y las claves VAPID van en los secretos de GitHub, y el `.gitignore` bloquea `.env*`, `*firebase-adminsdk*.json`, `*.pem` y `*.key`.
- La configuración web de Firebase (`VITE_FIREBASE_*`) no es secreta, porque acaba en el JavaScript que descarga cualquier navegador. Lo que protege los datos son las [reglas de Firestore](firestore.rules): solo los miembros de una casa pueden leerla o modificarla.
- El notificador solo escribe en los registros de Actions identificadores y recuentos, nunca el texto de vuestros eventos o notas (eso solo se ve en la prueba local con `DRY_RUN=1`).

## Desarrollo

```
src/
  shared/      Tipos, fechas y repeticiones (sin dependencias; también los usa el notificador)
  lib/         Firebase, modo demo, hooks, tiempo, luz, push, router
  components/  Componentes reutilizables (hojas, chips, editor de eventos…)
  pages/       Una pantalla por sección
  sw.ts        Service worker (offline y notificaciones)
notifier/      Script de notificaciones para GitHub Actions
firestore.rules  Reglas de seguridad: solo los miembros de la casa ven sus datos
```

- `npm run dev`: servidor local.
- `npm run build`: comprobación de tipos y compilación.
- `npm run deploy`: compila y publica en Firebase.
- `npm run icons`: regenera los iconos a partir de `public/favicon.svg`.

> **WSL o Windows, pero no los dos.** `node_modules` lleva binarios nativos del sistema que hizo `npm install` (Rolldown, TypeScript, esbuild). Este proyecto está instalado desde **WSL**. Si un día lo usas desde PowerShell, borra `node_modules` y `notifier/node_modules` y reinstala allí. Con el proyecto en `/mnt/d/...`, Vite vigila los archivos por sondeo para notar también los cambios hechos desde Windows (ya está configurado en `vite.config.ts`).

## Ideas para más adelante

- Pantalla de pared: una tablet barata o un marco de fotos «hackeado» (como el de Wes Bos) con la app abierta. La vista ancha ya está pensada para eso.
- Exportar el calendario como iCal para verlo en el calendario nativo del iPhone o de Google.
- Turnos de trabajo con patrones que se rellenen solos.
