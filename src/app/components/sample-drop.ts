import type { Drop } from "./drop-types";
import { DROP_003 } from "./sample-drop-003";

// Switch active drop here:
export const CURRENT_DROP: Drop = DROP_003;

// Drop #02 preserved below for reference / switching back
export const DROP_002: Drop = {
  "id": "drop-002-sexo-sin-misterio",
  "name": "Drop #02: Sexo Sin Misterio",
  "version": 1,

  "timeoutMessage": "Brutal eligió por vos.",

  "multiplierCheckpoints": {
    "5": { "multiplier": 1.25, "label": "x1.25" },
    "11": { "multiplier": 1.50, "label": "x1.50" }
  },

  "reveal": {
    "title": "Tu perfil\nde señal",
    "description": "Respondiste 20 estímulos sobre sexo, deseo, vergüenza y vulnerabilidad. Tus respuestas no dicen lo que pensás. Dicen lo que sentís antes de poder pensar.",

    "archetypes": [
      {
        "id": "senal-directa",
        "title": "Señal\ndirecta",
        "description": "Procesás el deseo con el cuerpo. No hay mucho filtro entre lo que sentís y lo que hacés. Para vos el sexo no es un tema — es una frecuencia que captás antes que los demás.",
        "formula": { "physical": 2, "visceral": 2, "guarded": -1.5 }
      },
      {
        "id": "filtro-activo",
        "title": "Filtro\nactivo",
        "description": "Hay una capa entre lo que sentís y lo que mostrás. No es miedo — es edición. Controlás la imagen, controlás el timing. El problema es que a veces el filtro funciona tan bien que ni vos sabés qué hay debajo.",
        "formula": { "guarded": 2, "cerebral": 2, "vulnerable": -1.5 }
      },
      {
        "id": "pantalla-espejo",
        "title": "Pantalla\nespejo",
        "description": "Tu relación con el deseo pasa por pantallas más de lo que admitirías. No es adicción — es el idioma que aprendiste. El scroll es tu foreplay. Y funciona, hasta que alguien te toca de verdad.",
        "formula": { "digital": 3, "physical": -1.5, "visceral": -0.5 }
      },
      {
        "id": "cable-pelado",
        "title": "Cable\npelado",
        "description": "Estás expuesto y lo sabés. No escondés lo que sentís — a veces ni podés. Eso te hace más real que la mayoría, pero también más fácil de lastimar. La vulnerabilidad no es tu debilidad. Es tu señal más fuerte.",
        "formula": { "vulnerable": 3, "physical": 1, "guarded": -2 }
      },
      {
        "id": "modo-automatico",
        "title": "Modo\nautomático",
        "description": "Respondés antes de pensar. Tu mapa sexual se armó solo — con lo que viste, lo que escuchaste, lo que te llegó sin pedirlo. No está mal. Pero la mayoría de tus preferencias las elegiste sin darte cuenta.",
        "formula": { "visceral": 3, "digital": 1, "cerebral": -2 }
      }
    ],

    "scoring": {
      "choiceScoring": [
        { "questionIndex": 0, "optionScores": [
          { "physical": 1 },
          { "physical": 1, "visceral": 1 },
          { "digital": 1 },
          { "visceral": 2 },
          { "guarded": 1, "cerebral": 1 }
        ]},
        { "questionIndex": 1, "optionScores": [
          { "vulnerable": 1 },
          { "cerebral": 1 },
          { "guarded": 1 },
          { "guarded": 1, "digital": 1 }
        ]},
        { "questionIndex": 3, "optionScores": [
          { "guarded": 1 },
          { "vulnerable": 1 },
          { "vulnerable": 1, "physical": 1 },
          { "digital": 1 }
        ]},
        { "questionIndex": 7, "optionScores": [
          { "physical": 1, "vulnerable": 1 },
          { "digital": 1 }
        ]},
        { "questionIndex": 9, "optionScores": [
          { "physical": 1, "vulnerable": 1 },
          { "cerebral": 1, "guarded": 1 }
        ]},
        { "questionIndex": 10, "optionScores": [
          { "physical": 2 },
          { "digital": 3 }
        ]},
        { "questionIndex": 11, "optionScores": [
          { "vulnerable": 2 },
          { "physical": 1 },
          { "digital": 1, "guarded": 1 }
        ]},
        { "questionIndex": 16, "optionScores": [
          { "physical": 2 },
          { "cerebral": 1, "vulnerable": 1 }
        ]},
        { "questionIndex": 19, "optionScores": [
          { "physical": 2, "vulnerable": 1 },
          { "digital": 3 }
        ]}
      ],
      "sliderScoring": [
        { "questionIndex": 2, "ranges": [
          { "min": 1, "max": 2, "scores": { "guarded": 1 } },
          { "min": 3, "max": 5, "scores": { "digital": 1 } }
        ]},
        { "questionIndex": 8, "ranges": [
          { "min": 0, "max": 3, "scores": { "guarded": 2 } },
          { "min": 4, "max": 6, "scores": { "cerebral": 1 } },
          { "min": 7, "max": 10, "scores": { "physical": 1, "vulnerable": 1 } }
        ]}
      ],
      "rankingScoring": [
        { "questionIndex": 12, "firstPlaceScores": [
          { "physical": 2, "visceral": 1 },
          { "cerebral": 2 },
          { "vulnerable": 2 },
          { "digital": 2 }
        ]}
      ],
      "rafagaScoring": [
        { "questionIndex": 13, "majorityA": { "visceral": 2, "physical": 1 }, "majorityB": { "cerebral": 1, "guarded": 1 } }
      ],
      "latencyScoring": {
        "fastThreshold": 2500,
        "fastScores": { "visceral": 2 },
        "slowThreshold": 4000,
        "slowScores": { "cerebral": 2 }
      }
    }
  },

  "questions": [

    {
      "type": "choice",
      "timer": 12,
      "text": "Suena reggaetón en una previa. ¿Qué te pasa PRIMERO?",
      "options": [
        "Me da energía",
        "Bailo",
        "Lo pongo en stories",
        "Me calienta",
        "Nada, es ruido de fondo"
      ],
      "reward": { "type": "tickets", "value": 30 },
      "result": { "percentage": 72, "text": "7 de cada 10 dijeron energía o baile. Casi nadie dijo que lo calienta." }
    },

    {
      "type": "choice",
      "timer": 12,
      "text": "Un pibe/piba te manda un audio de 3 minutos. ¿Qué hacés?",
      "options": [
        "Lo escucho entero",
        "Lo escucho en x2",
        "Lo abro y no lo escucho",
        "Lo dejo en visto"
      ],
      "reward": { "type": "tickets", "value": 25 }
    },

    {
      "type": "slider",
      "timer": 12,
      "text": "¿Cuánto contenido sexual ves POR DÍA en redes SIN BUSCARLO?",
      "min": 1,
      "max": 5,
      "labelLeft": "Casi nada",
      "labelRight": "Todo el tiempo",
      "reward": { "type": "tickets", "value": 30 },
      "result": { "percentage": 78, "text": "8 de cada 10 se pusieron en 3 o más. Ven sexo todo el día sin pedirlo." }
    },

    {
      "type": "choice",
      "timer": 15,
      "text": "¿Cuál de estas cosas te genera MÁS rechazo?",
      "options": [
        "Un tipo que te manda dick pics sin pedir",
        "Una mina que te dice que sos lindo pero no quiere salir",
        "Alguien que te ghostea después de coger",
        "Tu ex posteando con alguien nuevo"
      ],
      "reward": { "type": "tickets", "value": 30 }
    },

    {
      "type": "trap",
      "timer": 12,
      "text": "BRUTAL nunca revela tu identidad. Elegí la opción que dice EXACTAMENTE eso.",
      "options": [
        "BRUTAL comparte tus datos con marcas",
        "BRUTAL es 100% anónimo",
        "BRUTAL publica tu nombre si respondés mal"
      ],
      "correctIndex": 1,
      "penalty": 75
    },

    {
      "type": "prediction_bet",
      "timer": 20,
      "text": "¿Qué porcentaje de los que pasaron por acá eligió 'Me calienta' en la pregunta del reggaetón?",
      "optionA": "Menos del 15%",
      "optionB": "Más del 15%",
      "maxTickets": 100,
      "reward": { "type": "tickets", "value": 50 }
    },

    {
      "type": "dead_drop",
      "timer": 0,
      "firstLine": "PROCESANDO SEÑAL...",
      "codeLines": [
        "// analizando patrones de respuesta",
        "// cruzando con 792 nodos anteriores",
        "// detectando zona de vulnerabilidad",
        "// ...",
        "// señal encontrada"
      ],
      "lastLines": [
        "////////////////////////////////",
        "////// ENTRANDO EN ZONA HONESTA"
      ],
      "hourVariations": [
        {
          "fromHour": 0,
          "toHour": 6,
          "firstLine": "SEÑAL NOCTURNA DETECTADA...",
          "codeLines": [
            "// hora: madrugada",
            "// patrones de respuesta alterados",
            "// inhibición reducida en 47%",
            "// ...",
            "// señal más honesta de lo normal"
          ],
          "lastLines": [
            "////////////////////////////////",
            "////// A ESTA HORA NO SE MIENTE"
          ]
        },
        {
          "fromHour": 7,
          "toHour": 12,
          "firstLine": "PROCESANDO SEÑAL...",
          "codeLines": [
            "// analizando patrones de respuesta",
            "// cruzando con 792 nodos anteriores",
            "// detectando zona de vulnerabilidad",
            "// ...",
            "// señal encontrada"
          ],
          "lastLines": [
            "////////////////////////////////",
            "////// ENTRANDO EN ZONA HONESTA"
          ]
        },
        {
          "fromHour": 13,
          "toHour": 18,
          "firstLine": "ANALIZANDO NODO...",
          "codeLines": [
            "// hora pico de actividad",
            "// 1,247 nodos activos ahora mismo",
            "// tu señal es una entre miles",
            "// ...",
            "// pero no igual que ninguna"
          ],
          "lastLines": [
            "////////////////////////////////",
            "////// ENTRANDO EN ZONA HONESTA"
          ]
        },
        {
          "fromHour": 19,
          "toHour": 23,
          "firstLine": "SEÑAL NOCTURNA EMERGENTE...",
          "codeLines": [
            "// caen las defensas después de las 7pm",
            "// cruzando señales con 438 nodos nocturnos",
            "// patrón de vulnerabilidad: elevado",
            "// ...",
            "// la noche siempre extrae más verdad"
          ],
          "lastLines": [
            "////////////////////////////////",
            "////// ZONA DE MÁXIMA HONESTIDAD"
          ]
        }
      ]
    },

    {
      "type": "choice",
      "timer": 12,
      "text": "¿Qué da más miedo?",
      "options": [
        "Que te rechacen en persona",
        "Que te dejen en visto"
      ],
      "reward": { "type": "coins", "value": 0.15 },
      "result": { "percentage": 51, "text": "Mitad y mitad. El visto duele tanto como la cara. Pensá en eso." }
    },

    {
      "type": "slider",
      "timer": 12,
      "text": "Del 0 al 10: ¿cuánta confianza tenés en tu propio cuerpo DESNUDO frente a otra persona?",
      "min": 0,
      "max": 10,
      "labelLeft": "Ninguna",
      "labelRight": "Total",
      "reward": { "type": "tickets", "value": 40 }
    },

    {
      "type": "choice",
      "timer": 12,
      "text": "¿De qué tenés más vergüenza en privado?",
      "options": [
        "De tu cuerpo",
        "De tus deseos"
      ],
      "reward": { "type": "tickets", "value": 100 },
      "result": { "percentage": 44, "text": "Más gente de la que pensás eligió los deseos. El cuerpo se muestra. Los deseos se esconden." }
    },

    {
      "type": "choice",
      "timer": 15,
      "text": "Tenés que elegir UNA para siempre:",
      "options": [
        "Nunca más ver contenido sexual en redes",
        "Nunca más tener sexo real"
      ],
      "reward": { "type": "coins", "value": 0.25 },
      "result": { "percentage": 31, "text": "1 de cada 3 eligió eliminar el sexo real. Leé eso de nuevo." }
    },

    {
      "type": "choice",
      "timer": 12,
      "text": "¿Qué es más íntimo?",
      "options": [
        "Que alguien te vea llorar",
        "Que alguien te vea desnudo/a",
        "Que alguien lea tu historial de búsquedas"
      ],
      "reward": { "type": "tickets", "value": 35 }
    },

    {
      "type": "ranking",
      "timer": 22,
      "text": "Ordená de lo que MÁS te importa a lo que MENOS:",
      "options": [
        "Que te deseen físicamente",
        "Que te respeten intelectualmente",
        "Que te necesiten emocionalmente",
        "Que te envidien socialmente"
      ],
      "reward": { "type": "tickets", "value": 50 }
    },

    {
      "type": "rafaga",
      "timer": 25,
      "prompt": "Respondé con el instinto.",
      "promptBold": "¿Esto te calienta o te da cringe?",
      "secondsPerItem": 4,
      "items": [
        { "text": "Sexting con alguien que te gusta", "optionA": "Calienta", "optionB": "Cringe" },
        { "text": "Un video de TikTok sexual", "optionA": "Calienta", "optionB": "Cringe" },
        { "text": "Que te miren fijo en un bar", "optionA": "Calienta", "optionB": "Cringe" },
        { "text": "Letras de trap explícitas", "optionA": "Calienta", "optionB": "Cringe" },
        { "text": "Un nude bien sacado", "optionA": "Calienta", "optionB": "Cringe" },
        { "text": "Que alguien te toque el brazo hablando", "optionA": "Calienta", "optionB": "Cringe" }
      ],
      "reward": { "type": "coins", "value": 0.20 }
    },

    {
      "type": "trap",
      "timer": 10,
      "text": "¿Cuántas preguntas llevás respondidas en este Drop?",
      "options": [
        "Menos de 10",
        "Entre 10 y 15",
        "Más de 15"
      ],
      "correctIndex": 1,
      "penalty": 75
    },

    {
      "type": "prediction_bet",
      "timer": 20,
      "text": "En 2030, ¿la Gen Z argentina va a tener MÁS o MENOS sexo que hoy?",
      "optionA": "Menos",
      "optionB": "Más",
      "maxTickets": 150,
      "reward": { "type": "tickets", "value": 75 }
    },

    {
      "type": "choice",
      "timer": 12,
      "text": "Lo que más te excita de otra persona es...",
      "options": [
        "Algo físico",
        "Algo que no se ve"
      ],
      "reward": { "type": "tickets", "value": 100 },
      "result": { "percentage": 58, "text": "6 de cada 10 fueron por lo invisible. El cuerpo atrae, pero lo que no se ve engancha." }
    },

    {
      "type": "trap_silent",
      "timer": 12,
      "text": "Según los datos de este Drop, ¿cuántos ven contenido sexual en redes sin buscarlo?",
      "options": [
        "Menos del 30%",
        "Más del 70%",
        "Exactamente 50%"
      ],
      "correctIndex": 1,
      "penalty": 50,
      "reward": { "type": "tickets", "value": 30 }
    },

    {
      "type": "hot_take",
      "timer": 20,
      "text": "El porno educó a nuestra generación más que la ESI.",
      "options": [
        "Obvio",
        "Ni en pedo"
      ],
      "reward": { "type": "coins", "value": 0.20 },
      "result": { "percentage": 67, "text": "2 de cada 3 dijeron obvio. No es orgullo — es un dato." }
    },

    {
      "type": "choice",
      "timer": 15,
      "text": "Última. Sin vueltas:",
      "options": [
        "Una vida real con errores",
        "Una vida digital perfecta"
      ],
      "reward": { "type": "coins", "value": 0.30 },
      "result": { "percentage": 14, "text": "1 de cada 7 eligió lo digital. Pocos, pero existen. Y son los mismos que eligieron eliminar el sexo real." }
    }

  ]
};