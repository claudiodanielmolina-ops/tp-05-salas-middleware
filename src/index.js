const express = require("express");
const expressLayouts = require("express-ejs-layouts");
/* Se agrega esta línea de morgan */
const morgan = require("morgan");
const path = require("node:path");
const { leerJson } = require("./archivos");
const PORT = 3000;
const rutaDatos = path.join(__dirname, "..", "datos", "reservas.json");

let numeroDeSolicitud = 0;

function identificarSolicitud(req, res, next) {
    numeroDeSolicitud += 1;
    res.locals.solicitudId = `SOL-${String(numeroDeSolicitud).padStart(4, "0")}`;
    next();
}
function medirDuracion(req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
        const fin = process.hrtime.bigint();
        const milisegundos = Number(fin - inicio) / 1_000_000;
        console.log(
            `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} ${milisegundos.toFixed(2)} ms`,
        );
    });
    next();
}

function prepararReserva(req, res, next) {
    res.locals.seccion = "Reservas de turnos";
    next();
}

/* Defino el listado de salas permitidas */
const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];

function validarReserva(req, res, next) {
    const estudiante = String(req.body.estudiante ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const sala = String(req.body.sala ?? "").trim(); // Variable renombrada a 'sala'
    const fecha = String(req.body.fecha ?? "").trim();
    const turno = String(req.body.turno ?? "").trim();
    const personas = Number(req.body.personas);

    const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

    // Valido los campos vacíos, tipos de datos y opciones permitidas
    if (
        !estudiante ||
        !email ||
        !salasPermitidas.includes(sala) ||
        !fecha ||
        !turnosPermitidos.includes(turno) ||
        !Number.isInteger(personas) ||
        personas < 1 ||
        personas > 6
    ) {
        return res.status(400).render("reservas/nueva", {
            titulo: "Nueva reserva",
            error: "Completá todos los campos con valores válidos.",
            valores: req.body,
        });
    }

    req.reservaValidada = { estudiante, email, sala, fecha, turno, personas };
    next();
}

async function main() {
    const reservas = await leerJson(rutaDatos);
    const app = express();

    function crearReserva(req, res) {
        const ultimoId = reservas.reduce(
            (mayorId, reservas) => Math.max(mayorId, reservas.id),
            0,
        );
        reservas.push({ id: ultimoId + 1, ...req.reservaValidada });
        res.redirect("/reservas");
    }

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.use(expressLayouts);
    app.set("layout", "layouts/main");

    app.use(morgan("dev"));
    app.use(identificarSolicitud);
    app.use(medirDuracion);
    app.use(expressLayouts);

    app.use(express.static(path.join(__dirname, "..", "public")));
    app.use(express.urlencoded({ extended: false }));

    app.use(express.json());

    app.get("/", (req, res) => {
        res.render("inicio", { titulo: "Reserva de turnos" });
    });

    app.get("/api/reservas", (req, res) => {
        res.json(reservas);
    });

    const reservasRouter = express.Router();
    reservasRouter.use(prepararReserva);
    reservasRouter.get("/", (req, res) => {
        res.render("reservas/lista", {
            titulo: "Reservas de turnos",
            reservas,
        });
    })


    reservasRouter.get("/nueva", (req, res) => {
        res.render("reservas/nueva", {
            titulo: "Nueva reserva",
            error: null,
            valores: {},
        });
    });

    /* BLOQUE GET DE CÓDIGO CORREGIDO de reservas */
    reservasRouter.get("/:id", (req, res) => {
        const id = Number(req.params.id);
        const reserva = reservas.find((elemento) => elemento.id === id);
        if (!reserva) {
            return res.status(404).render("no-encontrado", {
                titulo: "Reserva no encontrada",
                mensaje: "No existe esa reserva.",
            });
        }
        res.render("reservas/detalle", {
            titulo: reserva.estudiante,
            reserva, // Se pasa la reserva encontrada a la vista
        });
    });

    reservasRouter.post("/", validarReserva, crearReserva);
    app.use("/reservas", reservasRouter);
    app.use((req, res) => {
        res.status(404).render("no-encontrado", {
            titulo: "Página no encontrada",
            mensaje: "La dirección solicitada no existe.",
        });
    });
    app.listen(PORT, () => {
        console.log(`Aplicación disponible en http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error("No se pudo iniciar la aplicación:", error);
    process.exitCode = 1;
});