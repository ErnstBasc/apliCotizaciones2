// Composición de las fuentes: crea los adaptadores reales (uno por tipo de dato) y los verifica.
// La comparten el servidor web (server.js) y el recolector (recolector.js), para que ambos lean exactamente
// las mismas fuentes sin repetir código. Es parte de la "raíz de composición": el único lugar que conoce las clases concretas.
const { verificarAdaptador } = require('./contracts/adaptador');
const { crearAdaptadorFrankfurter } = require('./adapters/frankfurter');
const { crearDescargadorPortada } = require('./adapters/bcb/portada');
const { crearAdaptadorBcbOficial } = require('./adapters/bcb/oficial');
const { crearAdaptadorBcbIndicadores } = require('./adapters/bcb/indicadores');
const { crearAdaptadorBinance } = require('./adapters/binance');
const { crearClienteDolarblue } = require('./adapters/dolarbluebolivia/cliente');
const { crearAdaptadorParaleloRespaldo } = require('./adapters/dolarbluebolivia/paralelo');
const { crearAdaptadorWallbit } = require('./adapters/dolarbluebolivia/wallbit');
const { crearAdaptadoresPlataformas } = require('./adapters/dolarbluebolivia/plataformas');
const { crearAdaptadorBancos } = require('./adapters/dolarbluebolivia/bancos');
const { conRespaldo } = require('./adapters/conRespaldo');
const { combinar } = require('./adapters/combinar');

function crearAdaptadores() {
  const obtenerPortadaBcb = crearDescargadorPortada();
  const clienteDolarblue = crearClienteDolarblue();
  return {
    monedas: verificarAdaptador(crearAdaptadorFrankfurter()),
    oficial: verificarAdaptador(crearAdaptadorBcbOficial({ obtenerTexto: obtenerPortadaBcb })),
    indicadores: verificarAdaptador(crearAdaptadorBcbIndicadores({ obtenerTexto: obtenerPortadaBcb })),
    // Billeteras y plataformas: Wallbit, Airtm, Takenos, El Dorado y Bitget en un solo adaptador; si una falla, las demás siguen
    billeteras: verificarAdaptador(combinar([
      crearAdaptadorWallbit({ cliente: clienteDolarblue }),
      ...crearAdaptadoresPlataformas({ cliente: clienteDolarblue }),
    ])),
    bancos: verificarAdaptador(crearAdaptadorBancos({ cliente: clienteDolarblue })),
    // Paralelo: Binance P2P; si falla, lectura agregada de dolarbluebolivia
    paralelo: verificarAdaptador(conRespaldo(
      crearAdaptadorBinance(),
      crearAdaptadorParaleloRespaldo({ cliente: clienteDolarblue })
    )),
  };
}

module.exports = { crearAdaptadores };
