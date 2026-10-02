const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const morgan = require("morgan");
const path = require("node:path");

const PORT = 3000;

// Definición directa de 4 reservas iniciales con formato BIB-XXXX
const reservas = [
    {
        id: "BIB-0001",
        estudiante: "Ana López",
        email: "ana.lopez@example.com",
        sala: "Sala Norte",
        fecha: "2026-10-01",
        turno: "Mañana",
        personas: 2
    },
    {
        id: "BIB-0002",
        estudiante: "Carlos Pérez",
        email: "carlos.perez@example.com",
        sala: "Sala Sur",
        fecha: "2026-10-02",
        turno: "Tarde",
        personas: 4
    },
    {
        id: "BIB-0003",
        estudiante: "María Gómez",
        email: "maria.gomez@example.com",
        sala: "Sala Multimedia",
        fecha: "2026-10-03",
        turno: "Noche",
        personas: 3
    },
    {
        id: "BIB-0004",
        estudiante: "Juan Martínez",
        email: "juan.martinez@example.com",
        sala: "Sala Norte",
        fecha: "2026-10-04",
        turno: "Mañana",
        personas: 1
    }
];

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
    res.locals.seccion = "Reservas de salas";
    next();
}

const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];

function validarReserva(req, res, next) {
    const estudiante = String(req.body.estudiante ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const sala = String(req.body.sala ?? "").trim();
    const fecha = String(req.body.fecha ?? "").trim();
    const turno = String(req.body.turno ?? "").trim();
    const personas = Number(req.body.personas);

    const turnosPermitidos = ["Mañana", "Tarde", "Noche"];

    if (
        !estudiante ||
        !email ||
        !email.includes("@") ||
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

function main() {
    const app = express();

    function crearReserva(req, res) {
        const siguienteNumero = reservas.length + 1;
        const nuevoId = `BIB-${String(siguienteNumero).padStart(4, "0")}`;
        reservas.push({ id: nuevoId, ...req.reservaValidada });
        res.redirect("/reservas");
    }

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.use(expressLayouts);
    app.set("layout", "layouts/main");

    app.use(morgan("dev"));
    app.use(identificarSolicitud);
    app.use(medirDuracion);

    app.use(express.static(path.join(__dirname, "..", "public")));
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    app.get("/", (req, res) => {
        res.render("inicio", { titulo: "Reserva de turnos" });
    });

    app.get("/estado", (req, res) => {
        res.json({ estado: "OK" });
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
    });

    reservasRouter.get("/nueva", (req, res) => {
        res.render("reservas/nueva", {
            titulo: "Nueva reserva",
            error: null,
            valores: {},
        });
    });

    reservasRouter.get("/:id", (req, res) => {
        const id = req.params.id;
        const reserva = reservas.find((elemento) => elemento.id === id);
        if (!reserva) {
            return res.status(404).render("no-encontrado", {
                titulo: "Reserva no encontrada",
                mensaje: "No existe esa reserva.",
            });
        }
        res.render("reservas/detalle", {
            titulo: reserva.estudiante,
            reserva,
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

main();