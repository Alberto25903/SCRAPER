# 🕹️ Agencia Pixel — agentes IA con vida propia

Una sala de estar retro en 2D donde viven y trabajan tres agentes IA. Les encargas tareas y ves cómo se organizan, debaten, investigan y entregan un informe. Cuando no tienen trabajo, hacen su vida.

![Agencia Pixel](https://img.shields.io/badge/estilo-pixel%20art-ffd166) ![Sin dependencias](https://img.shields.io/badge/dependencias-ninguna-2fbf71)

## Cómo abrirla

No hace falta instalar nada: abre `index.html` en el navegador (doble clic).
Si prefieres servirla: `npx serve agencia-ia` o `python3 -m http.server` dentro de la carpeta.

## El equipo

| Agente | Rol | Le gusta |
|---|---|---|
| **Nova** 🔎 | Investigadora | Leer en la butaca, mirar por la ventana, el café |
| **Byte** 💻 | Ingeniero | La consola, la recreativa, la nevera |
| **Luma** 🎨 | Estratega creativa (coordina) | Poner música y bailar, regar las plantas, charlar, la pizarra |
| **Bit** 🐈 | Gato de la oficina | Dormir, seguir a la gente, que le acaricien |

## Qué pasa en la sala

**Cuando les encargas algo** (a todo el equipo o a un agente concreto):

1. **Reunión de arranque**: se sientan en la mesa redonda, Luma lee el encargo y reparte el trabajo.
2. Según el tipo de tarea:
   - 💬 **Debate / decisión**: se levantan y se acercan en corro; cada uno da su postura, se responden (con emociones: dudas, enfados, ideas) y Luma propone un consenso.
   - 🔎 **Investigación**, 💻 **desarrollo**, 🎨 **creativo**, 📋 **general**: cada uno va a su puesto. El ordenador (busca en internet o programa; la pantalla cambia), la estantería (coge un libro y se sienta a leerlo), la pizarra (dibuja esquemas) o la mesa (portátil y notas).
3. **Puesta en común**: vuelven a la mesa y cuentan lo que han encontrado.
4. **Informe**: Luma lo redacta en la pizarra mientras los demás opinan. Aparece en la pestaña **Resultados** (se puede copiar o descargar en `.md`).

Si encargas algo a un solo agente, trabaja por su cuenta y suele ir a pedir opinión a un compañero libre.

**Cuando no hay trabajo** cada agente decide qué hacer según su personalidad y sus necesidades (energía, diversión, social y hambre): jugar a la consola (en cooperativo si se juntan), ver la tele, leer, tomar café, picar algo de la nevera, regar las plantas, jugar a la recreativa, poner música y bailar, mirar por la ventana, echar la siesta en el puf, garabatear en la pizarra, navegar por internet, jugar con Bit o **charlar entre ellos** (y se acuerdan de los últimos encargos).

Además hay ciclo de día y noche (el reloj de la pared y la ventana cambian, por la noche se encienden las lámparas y les entra sueño).

## IA real con Claude (opcional)

Sin configuración funciona en **modo simulado**: los agentes improvisan con plantillas.

Para que piensen de verdad, abre **⚙ Ajustes** y pega tu API key de Claude:

- Cada agente tiene su propia personalidad (prompt de sistema) y habla por turnos viendo la conversación.
- Luma planifica y reparte con salida estructurada (JSON).
- Quien usa el ordenador puede hacer **búsquedas web reales** (opcional).
- Las charlas de tiempo libre también pueden generarse con IA (opcional, consume más).
- Modelo por defecto: Claude Opus 5.5 (también Sonnet 5.5 y Haiku 5.5). En Opus/Sonnet se activa el *fallback* del servidor por si un clasificador de seguridad rechaza una petición.

Las llamadas van directamente desde tu navegador a la API de Anthropic con el SDK oficial (`@anthropic-ai/sdk`, cargado desde jsDelivr). La key solo se guarda si marcas «Recordar». No la uses en ordenadores compartidos ni publiques la página con tu key dentro.

Si una llamada falla, el agente lo indica en el registro e improvisa para no quedarse bloqueado.

## Controles

- **Encargar**: escribe la tarea, elige a quién (equipo o agente) y pulsa *Encargar*. Las tareas se ponen en cola.
- **Clic en un agente** (en la sala o en su ficha): lo selecciona y te responde. **Clic en Bit**: ronronea.
- **⏸ ▶ ▶▶ ▶▶▶**: pausa y velocidad del tiempo.

## Estructura

```
agencia-ia/
├── index.html
├── css/style.css
└── js/
    ├── engine.js   # estado global, rejilla, A*, iconos y partículas
    ├── world.js    # la sala: muebles, puntos de interacción, día/noche
    ├── agents.js   # agentes y gato: movimiento, acciones y sprites
    ├── life.js     # necesidades, actividades de tiempo libre y charlas
    ├── brains.js   # cerebro simulado y cerebro Claude
    ├── tasks.js    # encargos: reunión, debate, trabajo, informe
    ├── ui.js       # bocadillos, panel, registro, informes, ajustes
    └── main.js     # arranque y bucle principal
```

Todo está dibujado por código (sin imágenes) en un lienzo de 384×224 escalado en *pixel art*.
