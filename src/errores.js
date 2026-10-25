// Errores propios de la aplicación. Separan DOS mensajes:
//   - mensaje:  lo que ve el cliente (seguro, sin detalles internos)
//   - interno:  lo que se registra en el servidor para depurar (nunca se envía al cliente)

class ErrorApp extends Error {
  constructor(estado, mensaje, interno) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.interno = interno;
  }
}

class ErrorValidacion extends ErrorApp {
  constructor(mensaje) { super(400, mensaje); this.name = 'ErrorValidacion'; }
}

class ErrorFuente extends ErrorApp {
  constructor(fuente, interno) {
    super(502, `No se pudo obtener el dato de la fuente "${fuente}" y no hay datos guardados`, interno);
    this.name = 'ErrorFuente';
  }
}

class ErrorNoEncontrado extends ErrorApp {
  constructor(mensaje = 'Ruta no encontrada') { super(404, mensaje); this.name = 'ErrorNoEncontrado'; }
}

module.exports = { ErrorApp, ErrorValidacion, ErrorFuente, ErrorNoEncontrado };
