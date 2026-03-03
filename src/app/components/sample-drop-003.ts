import type { Drop } from "./drop-types";

export const DROP_003: Drop = {
  id: "drop-003-sin-anestesia",
  name: "Drop #03: Sin Anestesia",
  version: 1,

  timeoutMessage: "Brutal eligió por vos.",

  multiplierCheckpoints: {
    "6": { multiplier: 1.25, label: "x1.25" },
    "13": { multiplier: 1.50, label: "x1.50" },
  },

  reveal: {
    title: "Tu perfil\nde señal",
    description:
      "Respondiste 20 estímulos sobre identidad, cultura, deseo y honestidad. Tus respuestas no dicen lo que pensás. Dicen lo que sentís antes de poder pensar.",

    archetypes: [
      {
        id: "visceral-puro",
        title: "Visceral\npuro",
        description:
          "Reaccionás antes de pensar. Tu instinto procesa más rápido que tu conciencia. No es impulsividad — es un cable directo entre estímulo y respuesta que la mayoría perdió.",
        formula: { visceral: 2.5, impulse: 2, guarded: -1.5 },
      },
      {
        id: "blindaje-activo",
        title: "Blindaje\nactivo",
        description:
          "Hay una capa de control que filtra todo antes de que salga. No es miedo — es estrategia. El problema es que a veces el blindaje funciona tan bien que ni vos sabés qué hay debajo.",
        formula: { guarded: 2.5, cerebral: 2, vulnerable: -1.5 },
      },
      {
        id: "espejo-roto",
        title: "Espejo\nroto",
        description:
          "Lo que mostrás y lo que sentís no siempre coincide. No es mentira — es supervivencia social. Pero cuando la brecha crece demasiado, se convierte en ruido.",
        formula: { social: 2, guarded: 1.5, visceral: -1 },
      },
      {
        id: "señal-limpia",
        title: "Señal\nlimpia",
        description:
          "Sos consistente entre lo que pensás, decís y hacés. Eso no te hace mejor — te hace predecible. Y en un mundo de filtros, eso es casi radical.",
        formula: { vulnerable: 2, visceral: 1.5, guarded: -2 },
      },
      {
        id: "modo-nocturno",
        title: "Modo\nnocturno",
        description:
          "Procesás diferente cuando nadie mira. Tus respuestas más honestas aparecen cuando baja la guardia. La señal más clara es la que no sabés que estás emitiendo.",
        formula: { impulse: 2, vulnerable: 2, social: -1.5 },
      },
    ],

    scoring: {
      choiceScoring: [
        // Card 0: choice_emoji 💀/💪
        {
          questionIndex: 0,
          optionScores: [
            { vulnerable: 1, impulse: 1 },      // 💀
            { visceral: 1, impulse: 1 },          // 💪
          ],
        },
        // Card 1: choice — Messi / Bizarrap / Ninguno
        {
          questionIndex: 1,
          optionScores: [
            { social: 1 },
            { impulse: 1 },
            { guarded: 1 },
          ],
        },
        // Card 2: choice_emoji 😏/🫣 — SIGNAL PAIR A-1
        {
          questionIndex: 2,
          optionScores: [
            { visceral: 1, impulse: 1 },   // 😏
            { guarded: 1, vulnerable: 1 },   // 🫣
          ],
        },
        // Card 3: choice_hybrid
        {
          questionIndex: 3,
          optionScores: [
            { impulse: 1, visceral: 1 },  // Los agarro 💰
            { guarded: 1, cerebral: 1 },  // Ni en pedo 🔒
          ],
        },
        // Card 8: choice
        {
          questionIndex: 8,
          optionScores: [
            { vulnerable: 1, impulse: 1 },  // Algo que hice
            { guarded: 1, social: 1 },       // Algo que me hicieron
          ],
        },
        // Card 9: choice_hybrid SIGNAL PAIR B-1
        {
          questionIndex: 9,
          optionScores: [
            { social: 1, guarded: 1 },        // Mucho humo 🗣️
            { visceral: 1, vulnerable: 1 },    // Más de lo que cuentan 🤫
          ],
        },
        // Card 10: choice_hybrid
        {
          questionIndex: 10,
          optionScores: [
            { visceral: 1, impulse: 1 },  // Cumbia 🎵
            { social: 1 },                  // Taylor Swift 🎤
            { cerebral: 1 },                // Podcast 🧘
          ],
        },
        // Card 11: choice
        {
          questionIndex: 11,
          optionScores: [
            { vulnerable: 1 },
            { guarded: 1 },
          ],
        },
        // Card 12: choice_emoji 😂/😭
        {
          questionIndex: 12,
          optionScores: [
            { social: 1, impulse: 1 },      // 😂
            { vulnerable: 1 },               // 😭
          ],
        },
        // Card 14: choice_hybrid
        {
          questionIndex: 14,
          optionScores: [
            { cerebral: 1, social: 1 },      // Que te entienda 🧠
            { visceral: 1, impulse: 1 },     // Que te caliente 🔥
          ],
        },
        // Card 15: choice_emoji — SIGNAL PAIR A-2
        {
          questionIndex: 15,
          optionScores: [
            { visceral: 1, impulse: 1 },   // 😏
            { guarded: 1, vulnerable: 1 },   // 🫣
          ],
        },
        // Card 16: choice_hybrid — SIGNAL PAIR B-2
        {
          questionIndex: 16,
          optionScores: [
            { visceral: 1, impulse: 1 },    // Sobrevivo 😏
            { vulnerable: 1 },               // Me muero 💀
          ],
        },
        // Card 18: hot_take_visual
        {
          questionIndex: 18,
          optionScores: [
            { visceral: 1, impulse: 1 },
            { guarded: 1, cerebral: 1 },
          ],
        },
        // Card 19: choice_emoji 😏/🫣
        {
          questionIndex: 19,
          optionScores: [
            { visceral: 1 },  // 😏
            { guarded: 1 },   // 🫣
          ],
        },
      ],

      sliderScoring: [
        // Card 6: slider_emoji
        {
          questionIndex: 6,
          ranges: [
            { min: 1, max: 2, scores: { guarded: 1, vulnerable: 1 } },
            { min: 3, max: 3, scores: { social: 1 } },
            { min: 4, max: 5, scores: { visceral: 1, impulse: 1 } },
          ],
        },
      ],

      rafagaScoring: [
        // Card 4: rafaga_emoji 🔥/🧊
        {
          questionIndex: 4,
          majorityA: { visceral: 2, impulse: 1 },
          majorityB: { cerebral: 1, guarded: 1 },
        },
        // Card 13: rafaga_emoji 🔥/💀
        {
          questionIndex: 13,
          majorityA: { visceral: 2, impulse: 1 },
          majorityB: { vulnerable: 1, social: 1 },
        },
      ],

      latencyScoring: {
        fastThreshold: 2500,
        fastScores: { visceral: 2, impulse: 1 },
        slowThreshold: 4000,
        slowScores: { cerebral: 2, guarded: 1 },
      },
    },
  },

  questions: [
    // ── Card 0: choice_emoji ──
    {
      type: "choice_emoji",
      timer: 6,
      text: "Lunes. 7am.",
      options: ["💀", "💪"],
      reward: { type: "tickets", value: 25 },
    },

    // ── Card 1: choice ──
    {
      type: "choice",
      timer: 12,
      text: "Si pudieras cenar con una persona, ¿quién?",
      options: ["Messi", "Bizarrap", "Ninguno de los dos"],
      reward: { type: "tickets", value: 30 },
      result: { percentage: 47, text: "Eligió Messi." },
    },

    // ── Card 2: choice_emoji — SIGNAL PAIR A-1 ──
    {
      type: "choice_emoji",
      timer: 6,
      text: "Tu ex te manda un audio de 3 minutos.",
      options: ["😏", "🫣"],
      reward: { type: "tickets", value: 25 },
      signalPairId: "pair-A",
    },

    // ── Card 3: choice_hybrid ──
    {
      type: "choice_hybrid",
      timer: 10,
      text: "Encontrás $50.000 en la calle. Nadie te ve.",
      options: ["Los agarro 💰", "Ni en pedo 🔒"],
      reward: { type: "coins", value: 0.15 },
      result: { percentage: 71, text: "Los agarra." },
    },

    // ── Card 4: rafaga_emoji 🔥/🧊 ──
    {
      type: "rafaga_emoji",
      timer: 24,
      prompt: "",
      promptBold: "🔥 o 🧊",
      secondsPerItem: 3,
      items: [
        { text: "Milei", optionA: "🔥", optionB: "🧊" },
        { text: "Lali", optionA: "🔥", optionB: "🧊" },
        { text: "Bizarrap", optionA: "🔥", optionB: "🧊" },
        { text: "Duki", optionA: "🔥", optionB: "🧊" },
        { text: "Wanda", optionA: "🔥", optionB: "🧊" },
        { text: "Messi", optionA: "🔥", optionB: "🧊" },
      ],
      reward: { type: "coins", value: 0.20 },
    },

    // ── Card 5: trap ──
    {
      type: "trap",
      timer: 10,
      text: "Esto es una trampa. Elegí la opción que NO es una red social.",
      options: ["TikTok", "BeReal", "Letterboxd", "Notion"],
      correctIndex: 3,
      penalty: 75,
    },

    // ── Card 6: slider_emoji 🫣→😏 ──
    {
      type: "slider_emoji",
      timer: 12,
      text: "Una cámara te filma 24/7. ¿Cuánto te importa?",
      min: 1,
      max: 5,
      labelLeft: "🫣",
      labelRight: "😏",
      reward: { type: "tickets", value: 40 },
    },

    // ── Card 7: dead_drop ──
    {
      type: "dead_drop",
      timer: 0,
      firstLine: "PROCESANDO SEÑAL...",
      codeLines: [
        "> nodo activo: sin_anestesia",
        "> señales recibidas: en análisis",
        "> patrón detectado: en formación",
        "> coherencia: calculando...",
      ],
      lastLines: [
        "Tu señal se está formando.",
        "No pares ahora.",
      ],
      hourVariations: [
        {
          fromHour: 0,
          toHour: 6,
          firstLine: "SEÑAL NOCTURNA DETECTADA...",
          codeLines: [
            "> nodo activo: sin_anestesia",
            "> hora: madrugada",
            "> filtro social: desactivado",
            "> señal: más limpia que de día",
          ],
          lastLines: [
            "A esta hora no se miente.",
            "Seguí.",
          ],
        },
        {
          fromHour: 19,
          toHour: 23,
          firstLine: "SEÑAL NOCTURNA EMERGENTE...",
          codeLines: [
            "> nodo activo: sin_anestesia",
            "> hora: noche",
            "> nivel de guardia: descendiendo",
            "> calidad de señal: mejorando",
          ],
          lastLines: [
            "La noche siempre extrae más verdad.",
            "Seguí.",
          ],
        },
      ],
    },

    // ── Card 8: choice ──
    {
      type: "choice",
      timer: 12,
      text: "¿Qué te da más vergüenza recordar?",
      options: ["Algo que hice", "Algo que me hicieron"],
      reward: { type: "tickets", value: 35 },
    },

    // ── Card 9: choice_hybrid — SIGNAL PAIR B-1 ──
    {
      type: "choice_hybrid",
      timer: 12,
      text: "La vida sexual de tu generación es...",
      options: ["Mucho humo poco fuego 🗣️", "Más de lo que cuentan 🤫"],
      reward: { type: "tickets", value: 30 },
      result: { percentage: 54, text: "Dice que hay más humo." },
      signalPairId: "pair-B",
    },

    // ── Card 10: choice_hybrid ──
    {
      type: "choice_hybrid",
      timer: 12,
      text: "¿Qué escuchás cuando necesitás sentir algo?",
      options: ["Cumbia 🎵", "Taylor Swift 🎤", "Podcast 🧘"],
      reward: { type: "tickets", value: 30 },
    },

    // ── Card 11: choice ──
    {
      type: "choice",
      timer: 15,
      text: "¿Preferís que te digan la verdad aunque duela, o que te protejan?",
      options: ["La verdad, siempre", "Depende de quién"],
      reward: { type: "tickets", value: 35 },
      result: { percentage: 62, text: "Quiere la verdad." },
    },

    // ── Card 12: choice_emoji 😂/😭 ──
    {
      type: "choice_emoji",
      timer: 6,
      text: "",
      options: ["😂", "😭"],
      reward: { type: "tickets", value: 20 },
    },

    // ── Card 13: rafaga_emoji 🔥/💀 ──
    {
      type: "rafaga_emoji",
      timer: 21,
      prompt: "",
      promptBold: "🔥 o 💀",
      secondsPerItem: 3,
      items: [
        { text: "Decir 'te amo' primero", optionA: "🔥", optionB: "💀" },
        { text: "Leer en voz alta tu historial", optionA: "🔥", optionB: "💀" },
        { text: "Mostrar tu Spotify Wrapped", optionA: "🔥", optionB: "💀" },
        { text: "Que lean tus DMs", optionA: "🔥", optionB: "💀" },
        { text: "Tu familia ve tus likes", optionA: "🔥", optionB: "💀" },
      ],
      reward: { type: "coins", value: 0.25 },
    },

    // ── Card 14: choice_hybrid ──
    {
      type: "choice_hybrid",
      timer: 12,
      text: "¿Qué te importa más en una pareja?",
      options: ["Que te entienda 🧠", "Que te caliente 🔥"],
      reward: { type: "tickets", value: 40 },
      result: { percentage: 58, text: "Quiere que lo entienda." },
    },

    // ── Card 15: choice_emoji — SIGNAL PAIR A-2 ──
    {
      type: "choice_emoji",
      timer: 6,
      text: "Tu ex te manda un audio de 3 minutos.",
      options: ["😏", "🫣"],
      reward: { type: "tickets", value: 25 },
      signalPairId: "pair-A",
    },

    // ── Card 16: choice_hybrid — SIGNAL PAIR B-2 ──
    {
      type: "choice_hybrid",
      timer: 10,
      text: "Tu historial de búsqueda se publica. Con tu nombre.",
      options: ["Sobrevivo 😏", "Me muero 💀"],
      reward: { type: "coins", value: 0.25 },
      signalPairId: "pair-B",
    },

    // ── Card 17: trap_silent ──
    {
      type: "trap_silent",
      timer: 12,
      text: "¿En qué año se hizo el primer mundial de fútbol?",
      options: ["1930", "1942", "1928", "1934"],
      correctIndex: 0,
      penalty: 50,
      reward: { type: "tickets", value: 30 },
    },

    // ── Card 18: hot_take_visual ──
    {
      type: "hot_take_visual",
      timer: 20,
      text: "Si pudieras saber exactamente qué piensa de vos cada persona que conocés.",
      options: ["Quiero saber", "Prefiero no saber"],
      reward: { type: "coins", value: 0.20 },
      result: { percentage: 44, text: "Prefiere no saber." },
    },

    // ── Card 19: choice_emoji — meta ──
    {
      type: "choice_emoji",
      timer: 8,
      text: "¿Fuiste honesto en este drop?",
      options: ["😏", "🫣"],
      reward: { type: "tickets", value: 50 },
    },
  ],
};
