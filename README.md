## Trabajo práctico 05 - Pipeline de middleware en Express

## Descripción
Aplicación web desarrollada con Express y EJS para consultar salas de estudio y reservar turnos temporalmente. El proyecto se centra en el diseño, orden y ejecución del pipeline de middleware para registrar, identificar, medir, preparar y validar solicitudes HTTP.

## Instalación
1. Clonar el repositorio.
2. Instalar las dependencias de producción y desarrollo ejecutando:
    
    npm install
    npm start

## Rutas
    GET /: Página de inicio con explicación del propósito del sitio.

    GET /estado (o /api/reservas): Estado del servicio e información JSON.

    GET /reservas: Listado general de reservas registradas.

    GET /reservas/nueva: Formulario de alta de reservas.

    GET /reservas/:id: Detalle individual de una reserva mediante su ID.

    POST /reservas: Procesamiento y creación de una nueva reserva con validación en servidor.

## Pipeline de middleware sigue el orden de ejecución en src/index.js:

1- Morgan (morgan("dev")): Middleware de terceros para el registro (logging) de solicitudes HTTP.

2- identificarSolicitud: Middleware personalizado global que asigna un ID secuencial único (res.locals.solicitudId).

3- medirDuracion: Middleware personalizado global que escucha el evento finish de la respuesta para medir el tiempo total de procesamiento.

4- expressLayouts: Middleware de terceros para renderizar plantillas EJS integrando el layout principal.

5- express.static: Middleware incorporado para servir archivos estáticos (public/).

6- express.urlencoded & express.json: Middlewares incorporados para parsear el cuerpo de las peticiones en req.body.

7 -reservasRouter (app.use("/reservas", ...)): Router de área que integra prepararReserva y maneja las rutas específicas.

8 -Manejador 404 global: Middleware final ejecutado únicamente cuando ninguna ruta previa captura la petición.

## Diagrama del POST válido (POST /reservas)

POST /reservas
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
expressLayouts
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
validarReserva ──► [Éxito] Asigna req.reservaValidada
     │
     ▼
crearReserva ────► Guarda en memoria y responde HTTP 302 Redirect (/reservas)
     │
     └───────────► res.on("finish") emite evento: Imprime ID + Método + URL + Estado (302) + Duración (ms)

## Diagrama del POST inválido (POST /reservas)

POST /reservas
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
expressLayouts
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
validarReserva ──► [Error] **AQUÍ TERMINA EL CICLO**
                   Responde HTTP 400 y renderiza "reservas/nueva" con mensaje de error y valores previos.
     │
     └───────────► res.on("finish") emite evento: Imprime ID + Método + URL + Estado (400) + duración (ms)

     Punto de finalización en camino inválido: El ciclo de la petición interrumpe su avance hacia crearReserva dentro de la función validarReserva, retornando directamente la respuesta res.status(400).render(...).
## Alcance de cada función: 

identificarSolicitud (Global): Incrementa un contador y asigna res.locals.solicitudId (ej. SOL-0001), permitiendo disponer de este dato en las vistas y respuestas.

medirDuracion (Global): Captura el tiempo en nanosegundos (process.hrtime.bigint()) e instala un listener sobre el evento finish del objeto res para calcular e imprimir los milisegundos transcurridos una vez enviada la respuesta completa.

prepararReserva (Router): Asigna res.locals.seccion = "Reservas de turnos" únicamente a las peticiones que ingresen por la sub-ruta /reservas.

validarReserva (Ruta específica): Middleware aplicado exclusivamente a POST /reservas. Normaliza strings con trim(), parsea valores numéricos, valida campos obligatorios, restringe opciones contra listas permitidas (salasPermitidas y turnosPermitidos) y asegura valores válidos de personas (1 a 6) e email.

## Validación

La validación del formulario se realiza exclusivamente en el servidor mediante el middleware `validarReserva` sobre la ruta `POST /reservas`.

### Proceso y reglas aplicadas:
1. Normalización: Se aplica `.trim()` a los campos de texto (`estudiante`, `email`, `sala`, `fecha`, `turno`).
2. Conversión de tipos: Se convierte el campo `personas` a un número con `Number()`.
3. Comprobación de campos obligatorios: Ningún campo de texto debe quedar vacío tras la normalización.
4. Opciones permitidas:
   * `sala`: Debe pertenecer a la lista de salas permitidas (`"Sala Norte"`, `"Sala Sur"`, `"Sala Multimedia"`).
   * `turno`: Debe ser una de las opciones válidas (`"Mañana"`, `"Tarde"`, `"Noche"`).
5. Rango y tipo de personas: Se verifica que sea un número entero comprendido entre 1 y 6 (`personas >= 1 && personas <= 6`).
6. Validación de Email: Se realiza una comprobación básica verificando que el texto contenga el carácter `@`.

### Caminos de ejecución:
* Camino inválido (Error 400): Si alguna de las reglas no se cumple, el middleware interrumpe el flujo, asigna el código de estado `HTTP 400`, renderiza la vista `reservas/nueva` conservando los valores ingresados en `req.body` y muestra un mensaje accesible con el atributo `role="alert"`.
* Camino válido (Éxito): Si los datos son correctos, el middleware construye un objeto saneado en `req.reservaValidada` y llama a `next()` para pasar el control al handler `crearReserva`, el cual almacena la reserva en memoria y redirige a `/reservas` mediante una respuesta `HTTP 302`.

## Pruebas manuales

A continuación se detalla el cumplimiento de la matriz de pruebas solicitada mediante la ejecución de los diferentes casos de uso.

Caso de prueba -  Estado esperado - Evidencia de comportamiento 

Inicio (`GET /`) 200 Renderiza la portada con menú de navegación e ID de solicitud en el pie.
Estado (`GET /api/reservas`) 200 Devuelve la lista JSON con las reservas actuales. 
Listado (`GET /reservas`) 200 Muestra la lista con las reservas cargadas o un mensaje alternativo si está vacía.
Formulario (`GET /reservas/nueva`) 200 Carga los controles etiquetados adecuadamente.
Detalle válido (`GET /reservas/:id`) 200 Muestra los detalles completos de la reserva encontrada
Campos vacíos (`POST /reservas`) 400 Detiene el envío, muestra la alerta `role="alert"` y conserva los valores previos.
Sala no permitida (`POST /reservas`) 400 Rechaza la solicitud si la sala no coincide con las permitidas.
Turno no permitido (`POST /reservas`) 400 Rechaza la solicitud si el turno difiere de Mañana, Tarde o Noche.
Email sin `@` (`POST /reservas`) 400 Responde con error de validación sin crear el registro.
Personas igual a 0 o 7 (`POST /reservas`) 400 Rechaza solicitudes fuera del rango permitido (1 a 6).
Reinicio de aplicación 200 Restablece el estado a las reservas iniciales en memoria.

## Persistencia temporal

La aplicación utiliza un esquema de persistencia en memoria volátil (RAM) para la gestión de datos durante la ejecución:

* Inicialización: Los datos de las reservas se leen/cargan en memoria al iniciar el servidor a través del arreglo `reservas` desde la fuente de datos en `datos/reservas.json` o los valores por defecto del sistema.
* Altas en caliente: Cuando se completa un `POST /reservas` válido, la función `crearReserva` genera un nuevo ID secuencial dinámico y añade el elemento al arreglo mediante `.push()` únicamente en memoria.
* Comportamiento ante reinicio: Al no escribirse las nuevas altas en ningún archivo físico ni base de datos, cualquier reinicio del servidor o del proceso de Node.js liberará la memoria RAM, provocando que los nuevos registros desaparezcan y la aplicación vuelva exactamente a su estado inicial cargado en el arranque.


### Explicaciones (Punto 16)

* ¿Cuál es la diferencia entre los tipos de middleware?
* Incorporado (el que ya trae Express):** Son herramientas que vienen listas dentro de Express. Por ejemplo, la que sirve para leer los datos que la gente manda desde los formularios (`express.urlencoded`) o la que muestra archivos como imágenes y estilos CSS (`express.static`).

* De terceros (los que instalamos con `npm`): Son programas hechos por otras personas que agregamos al proyecto para facilitarnos la vida. Un ejemplo es `morgan`, que nos muestra en la pantalla de la terminal qué páginas va pidiendo la gente.

* Personalizado (los que creamos nosotros): Son las funciones que escribimos desde cero con código propio para hacer lo que necesita nuestro sitio. Por ejemplo, la función que le asigna un número a cada pedido (`identificarSolicitud`) o la que revisa que los datos del formulario estén bien cargados (`validarReserva`).

* ¿Cuándo y para qué se usa `next()`?
* Se usa cuando una función ya terminó su trabajo y le dice a Express: "Listo, ya terminé por acá, pasa a la siguiente función". Si te olvidas de poner `next()` y tampoco le das una respuesta al usuario (como mostrarle una página o mandarle un mensaje), la página se queda "pensando" o cargando para siempre sin mostrar nada.

* ¿Por qué los "parsers" (los que leen datos) van antes de la validación?
* Porque los parsers son los encargados de agarrar el paquete con la información que envió el usuario y transformarlo en una lista limpia de datos (`req.body`) que Node.js pueda entender. Si pusiéramos la validación antes, intentaríamos revisar datos que todavía no se han abierto ni procesado, por lo que nos daría un error diciendo que no hay nada.

* ¿Qué diferencia hay entre alcance global, de router y de ruta?
* Global: Se ejecuta "siempre", para absolutamente cualquier página o archivo que se pida en el sitio (ej. el que cuenta las visitas o mide el tiempo).

* De router: Se ejecuta únicamente para un grupo o sección entera del sitio. En nuestro caso, solo cuando alguien entra a alguna página dentro de `/reservas`.

* De ruta: Se ejecuta para una sola acción bien específica. Por ejemplo, la validación solo salta cuando alguien hace clic en "Enviar" para guardar un nuevo formulario en `POST /reservas`.

* ¿Para qué sirve el evento `finish`?
* Sirve para saber exactamente el momento en que el servidor "terminó de enviarle" toda la respuesta al navegador de la persona. Lo usamos para medir el tiempo porque es la única forma de saber cuántos milisegundos reales tardó todo el proceso y ver si la página cargó bien (código 200) o si dio un error (código 400 o 404).

* ¿Qué pasa al "montar" el router?
* Significa que le decimos a Express: "A partir de ahora, todo lo que esté en este grupo va a empezar con la palabra `/reservas`". Esto nos ahorra tener que escribir `/reservas/nueva`, `/reservas/lista` y `/reservas/detalle` a cada rato en el código.

* ¿Por qué hay un POST 302 y después un GET?
* Es para evitar que se dupliquen datos.

1. El POST con respuesta 302: El servidor recibe los datos del formulario, los guarda y le da una "orden de redirección" al navegador.

2. El GET posterior: El navegador automáticamente le pide la lista de reservas al servidor.

* Gracias a esto, si el usuario aprieta F5 o "Recargar", no se vuelve a enviar el formulario ni se crea la misma reserva dos veces.

* ¿Por qué las reservas nuevas desaparecen si reinicio el servidor?
* Porque las nuevas reservas no se están guardando en un archivo de texto ni en una base de datos permanente, sino en la memoria RAM de la computadora. La memoria RAM es temporal: en cuanto apagamos o reiniciamos el servidor con Node.js, esa memoria se borra por completo y el programa vuelve a arrancar solo con los datos guardados al principio.