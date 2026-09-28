## Trabajo práctico 05 - Pipeline de middleware en Express

## Descripción
Aplicación web desarrollada con Express y EJS para consultar salas de estudio y reservar turnos temporalmente. El proyecto se centra en el diseño, orden y ejecución del pipeline de middleware para registrar, identificar, medir, preparar y validar solicitudes HTTP.

## Instalación
1- Clonar el repositorio.
2- Instalar las dependencias de producción y desarrollo ejecutando:
    
    npm install
    npm start

## Rutas
 GET /: Página de inicio con explicación del propósito del sitio.
 GET /estado: Estado del servicio HTTP en formato JSON "estado": "OK".
 GET /api/reservas: Información del listado general de reservas en JSON.
 GET /reservas: Listado general de reservas registradas.
 GET /reservas/nueva: Formulario de alta de reservas.
 GET /reservas/:id: Detalle individual de una reserva mediante su ID formato "BIB-XXXX".
 POST /reservas: Procesamiento y creación de una nueva reserva con validación en servidor.
 Rutas no encontradas: Se redirecciona al renderizado de la página 404 no-encontrado.ejs con código de estado HTTP 404.

## Pipeline de middleware

Sigue el orden de ejecución implementado en `src/index.js`:

1- Configuración de Vistas y Layout: Registro de expressLayouts app.use(expressLayouts) y plantilla base (layouts/main).
2- Morgan (morgan("dev")): Middleware de terceros para el registro (logging) de solicitudes HTTP en la consola.
3- identificarSolicitud: Middleware personalizado global que asigna un ID secuencial único a cada petición en res.locals.solicitudId (ej. SOL-0001).
4- medirDuracion: Middleware personalizado global que escucha el evento finish de la respuesta para medir el tiempo total de procesamiento en milisegundos.
5- express.static: Middleware incorporado para servir archivos estáticos (public/).
6- express.urlencoded & express.json: Middlewares incorporados para parsear (analizar una cadena de texto para transformarla en una estructura de datos organizada) el cuerpo de las peticiones en req.body.
7- reservasRouter (app.use("/reservas", ...)): Router de área que integra el middleware prepararReserva y maneja las rutas específicas del módulo.
8- Manejador 404 global: Middleware final ejecutado únicamente cuando ninguna ruta previa captura la petición, renderizando la vista no-encontrado con código HTTP 404.

## Diagrama del POST válido (`POST /reservas`)

POST /reservas
│
▼
expressLayouts
│
▼
morgan("dev")
│
▼
identificarSolicitud
│
▼
medirDuracion ───► (Registra listener res.on("finish"))
│
▼
express.urlencoded / express.json
│
▼
reservasRouter
│
▼
prepararReserva
│
▼
validarReserva ──► Éxito // Asigna req.reservaValidada
│
▼
crearReserva ────► Guarda en memoria y responde HTTP 302 Redirect (/reservas)
│
└───────────► res.on("finish") emite evento: Imprime ID + Método + URL + Estado (302) + Duración (ms)

## Diagrama del POST inválido (`POST /reservas`)

POST /reservas
│
▼
expressLayouts
│
▼
morgan("dev")
│
▼
identificarSolicitud
│
▼
medirDuracion ───► (Registra listener res.on("finish"))
│
▼
express.urlencoded / express.json
│
▼
reservasRouter
│
▼
prepararReserva
│
▼
validarReserva ──► Error // AQUÍ TERMINA EL CICLO
Responde HTTP 400 y renderiza "reservas/nueva" con mensaje de error (role="alert") y valores previos.
│
└───────────► res.on("finish") emite evento: Imprime ID + Método + URL + Estado (400) + duración (ms)

Punto de finalización en camino inválido: El ciclo de la petición interrumpe su avance hacia crearReserva dentro de la función validarReserva, retornando directamente la respuesta res.status(400).render(...).

## Alcance de cada función: 

* identificarSolicitud (Global): Incrementa un contador y asigna res.locals.solicitudId (ej. SOL-0001), permitiendo disponer de este dato en las vistas y respuestas.
* medirDuracion (Global): Captura el tiempo en nanosegundos (process.hrtime.bigint()) e instala un listener sobre el evento finish del objeto res para calcular e imprimir los milisegundos transcurridos una vez enviada la respuesta completa.
* prepararReserva (Router): Asigna res.locals.seccion = "Reservas de salas" únicamente a las peticiones que ingresen por la sub-ruta /reservas.
* validarReserva (Ruta específica): Middleware aplicado exclusivamente a POST /reservas. Normaliza cadenas con .trim(), parsea valores numéricos, valida campos obligatorios, verifica que el correo contenga @, restringe opciones contra listas permitidas (salasPermitidas y turnosPermitidos) y asegura valores válidos de personas (1 a 6).

## Validación

La validación del formulario se realiza exclusivamente en el servidor mediante el middleware validarReserva sobre la ruta POST /reservas.

## Proceso y reglas aplicadas:
1- Normalización: Se aplica .trim() a los campos de texto (estudiante, email, sala, fecha, turno).
2- Conversión de tipos: Se convierte el campo personas a un número con Number().
3- Comprobación de campos obligatorios: Ningún campo de texto debe quedar vacío tras la normalización.
4- Validación de Email: Se realiza la verificación obligatoria comprobando que la cadena incluya el carácter @ (email.includes("@")).
5- Opciones permitidas:
   * sala: Debe pertenecer a la lista de salas permitidas ("Sala Norte", "Sala Sur", "Sala Multimedia").
   * turno: Debe ser una de las opciones válidas ("Mañana", "Tarde", "Noche").
7- Rango y tipo de personas: Se verifica que sea un número entero comprendido entre 1 y 6 (personas >= 1 && personas <= 6).

## Caminos de ejecución:
* Camino inválido (Error 400): Si alguna de las reglas no se cumple, el middleware interrumpe el flujo, asigna el código de estado HTTP 400, renderiza la vista reservas/nueva conservando los valores ingresados en req.body y muestra un mensaje accesible mediante la alerta de HTML con el atributo role="alert".
* Camino válido (Éxito): Si los datos son correctos, el middleware construye un objeto saneado en req.reservaValidada y llama a next() para pasar el control al handler crearReserva, el cual genera un ID correlativo con formato BIB-XXXX, almacena la reserva en memoria y redirige a /reservas mediante una respuesta HTTP 302.

## Pruebas manuales

A continuación se detalla el cumplimiento de la matriz de pruebas solicitada mediante la ejecución de los diferentes casos de uso:

| Caso de prueba | Estado esperado | Evidencia de comportamiento |
|---|---|---|
| Inicio (GET /) | 200 | Renderiza la portada con el layout común, menú de navegación e ID de solicitud en el pie. |
| Estado (GET /estado) | 200 | Responde con el JSON { "estado": "OK" }. |
| API Listado (GET /api/reservas) | 200 | Devuelve la lista JSON con las reservas actuales. |
| Listado (GET /reservas) | 200 | Muestra la lista con las reservas cargadas o un mensaje alternativo si está vacía, indicando la sección "Reservas de salas". |
| Formulario (GET /reservas/nueva) | 200 | Carga los controles etiquetados adecuadamente. |
| Detalle válido (GET /reservas/:id) | 200 | Muestra los detalles completos de la reserva encontrada (ej. BIB-0001). |
| Ruta inexistente (GET /ruta-invalida) | 404 | Renderiza la vista no-encontrado.ejs con mensaje accesible y layout global. |
| Campos vacíos (POST /reservas) | 400 | Detiene el envío, muestra la alerta con role="alert" y conserva los valores previos en la vista. |
| Sala no permitida (POST /reservas) | 400 | Rechaza la solicitud si la sala no coincide con las permitidas. |
| Turno no permitido (POST /reservas) | 400 | Rechaza la solicitud si el turno difiere de Mañana, Tarde o Noche. |
| Email sin @ (POST /reservas) | 400 | Responde con error de validación sin crear el registro. |
| Personas fuera de rango (POST /reservas) | 400 | Rechaza solicitudes fuera del rango permitido (1 a 6). |
| Reinicio de aplicación | 200 | Restablece el estado a las 4 reservas iniciales en memoria (BIB-0001 a BIB-0004). |

## Persistencia temporal

La aplicación utiliza un esquema de persistencia en memoria volátil (RAM) para la gestión de datos durante la ejecución:

* Inicialización: Los datos de las reservas se leen/cargan en memoria al iniciar el servidor a través del arreglo reservas desde el archivo datos/reservas.json con cuatro reservas con IDs BIB-0001 a BIB-0004.
* Altas en caliente: Cuando se completa un POST /reservas válido, la función crearReserva genera un nuevo ID secuencial dinámico (BIB-XXXX) y añade el elemento al arreglo mediante .push() únicamente en memoria.
* Comportamiento ante reinicio: Al no escribirse las nuevas altas en el archivo físico, cualquier reinicio del servidor liberará la memoria RAM, provocando que los nuevos registros desaparezcan y la aplicación vuelva a su estado inicial.

## Explicaciones (Punto 16)

* ¿Cuál es la diferencia entre los tipos de middleware?
  * Incorporado (el que ya trae Express): Son herramientas nativas de Express. Por ejemplo, express.urlencoded para parsear formularios o express.static para servir archivos estáticos (CSS, imágenes).
  * De terceros (los que instalamos con npm): Paquetes externos agregados al proyecto. Ejemplo: morgan para registrar logs HTTP en la consola o express-ejs-layouts para gestionar plantillas de interfaz.
  * Personalizado (los que creamos nosotros): Funciones escritas con código propio. Ejemplo: identificarSolicitud (asigna IDs únicos) o validarReserva (comprueba campos requeridos).

* ¿Cuándo y para qué se usa next()?
  * Se llama cuando una función middleware finaliza sus tareas y le transfiere el control a la siguiente función en la cadena de Express. Si no se invoca next() ni se finaliza la respuesta (res.render / res.json), la petición queda colgada indefinidamente.

* ¿Por qué los "parsers" (los que leen datos) van antes de la validación?
  * Porque se encargan de decodificar y estructurar los datos recibidos en el objeto req.body. Si colocáramos la validación antes, la propiedad req.body estaría indefinida o vacía.

* ¿Qué diferencia hay entre alcance global, de router y de ruta?
  * Global: Se ejecuta para todas las peticiones entrantes a la aplicación (ej. identificarSolicitud, medirDuracion).
  * De router: Se ejecuta únicamente para un prefijo o subgrupo de rutas (ej. prepararReserva montado en /reservas).
  * De ruta: Se aplica exclusivamente a un método y endpoint específico (ej. validarReserva en POST /reservas).

* ¿Para qué sirve el evento finish?
  * Se emite cuando el servidor termina de enviar todos los datos de la respuesta al cliente. Permite calcular con exactitud la duración completa del ciclo de la solicitud HTTP.

* ¿Qué pasa al "montar" el router?
  * Se vincula una instancia de express.Router() a un prefijo de ruta (ej. app.use("/reservas", reservasRouter)), permitiendo agrupar endpoints y middlewares específicos.

* ¿Por qué hay un POST 302 y después un GET?
  * Aplica el patrón PRG (Post/Redirect/Get)** para evitar el reenvío de formularios si el usuario recarga la página:
   1- El POST procesa los datos y responde con una redirección HTTP 302.
   2- El navegador realiza automáticamente un GET /reservas para consultar la lista actualizada.

* ¿Por qué las reservas nuevas desaparecen si reinicio el servidor?
  * Porque se almacenan únicamente en la memoria RAM del proceso en ejecución. Al reiniciar el servidor de Node.js, la memoria se libera y se recargan los datos iniciales desde el archivo JSON.