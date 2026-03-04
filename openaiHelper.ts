import OpenAI from "openai";
import dotenv from "dotenv";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Proben } from "./bmvSync";

// Load environment variables from .env file
dotenv.config();

export const PROBE_CATEGORIES = [
  "Ensembleprobe",
  "Gesamtorchester Teilprobe",
  "Jugendorchester Vollprobe",
  "Gesamtorchester Vollprobe",
  "Jugendorchester Teilprobe",
  "Sitzung",
];

export const EVENT_CATEGORIES = [
  "Vereinseigene Konzerte",
  "Kirchliche Feierlichkeiten",
  "Wettbewerbe/Wertungsspiele",
  "Veranstaltungen privater Körperschaften",
  "Sonstige Anlässe",
  "Veranstaltungen von Tourismusverbänden",
  "Private Anlässe",
  "Öffentliche Anlässe (Gemeinde, Parteien)",
  "Begräbnisse",
  "Vereinseigene Musikfeste",
];

// Define the schema for the classification response
const ClassificationResponse = z.object({
  category: z.string(),
  confidence: z.number(),
  reasoning: z.string().nullable(),
});

/**
 * Rule-based classifier for probe (rehearsal) categories.
 */
function classifyProbeByRules(text: string): string | null {
  const t = text.toLowerCase();

  // Sitzung / meetings
  if (/sitzung|jahreshauptversammlung|vorstandswechsel|hauptversammlung/.test(t)) {
    return "Sitzung";
  }

  // Register/section rehearsals → Gesamtorchester Teilprobe
  if (/registerprobe|registerservice/.test(t)) {
    return "Gesamtorchester Teilprobe";
  }
  // "Probe Holz", "Probe Blech", "Probe Schlagzeug" (but NOT "Probe bildSTARS")
  if (/\bprobe\s+(holz|blech|schlagzeug|flöte|klarinette|saxophon|horn|posaune|tuba|tenorhorn|trompete|hohes blech|tiefes blech)\b/.test(t)) {
    return "Gesamtorchester Teilprobe";
  }

  // Youth/ensemble subgroups
  if (/bildstar|jugendmusik|jugendorchester/.test(t)) {
    return "Ensembleprobe";
  }

  // Everything else: Vollprobe, Gesamtprobe, Generalprobe, Hauptprobe, Probenwochenende, Marschprobe, etc.
  return "Gesamtorchester Vollprobe";
}

/**
 * Rule-based classifier for event (Veranstaltung) categories.
 */
function classifyEventByRules(text: string): string | null {
  const t = text.toLowerCase();

  // Church events
  if (/krönung|seelensonntag|fronleichnam|erstkommunion|christmette|firmung|gottesdienst|prozession|allerheiligen|kirchlich|messgestaltung/.test(t)) {
    return "Kirchliche Feierlichkeiten";
  }

  // Competitions
  if (/wettbewerb|wertung|marschwertung/.test(t)) {
    return "Wettbewerbe/Wertungsspiele";
  }

  // Private occasions
  if (/geburtstag|hochzeit|taufe|ständchen|trauzeugen/.test(t)) {
    return "Private Anlässe";
  }

  // Funerals
  if (/begräbnis|beerdigung|trauerfeier/.test(t)) {
    return "Begräbnisse";
  }

  // Concerts (own)
  if (/konzert(?!meister)/.test(t)) {
    return "Vereinseigene Konzerte";
  }

  // Own festivals/events
  if (/musikfest|unterhaltungsabend|christbaumfeier|musigball|\bball\b|tag der blasmusik|feuerwehrfest/.test(t)) {
    return "Vereinseigene Musikfeste";
  }

  // Public occasions
  if (/silvesterblasen|silvester|gemeindevertretung|gemeinde(?!.*verein)|bürgermeister/.test(t)) {
    return "Öffentliche Anlässe (Gemeinde, Parteien)";
  }

  // Carnival / misc public
  if (/funken|fasching|faschingsumzug/.test(t)) {
    return "Sonstige Anlässe";
  }

  // Default for events — "Sonstige Anlässe" is safest
  return "Sonstige Anlässe";
}

/**
 * Rule-based fallback classifier. Returns a category from the given list,
 * or null if no confident match (caller should use OpenAI).
 */
export function classifyByRules(
  text: string,
  categories: string[],
  isProbe: boolean
): string {
  const result = isProbe
    ? classifyProbeByRules(text)
    : classifyEventByRules(text);

  // Verify the result is in the allowed categories
  if (result) {
    const match = categories.find(
      (cat) => cat.toLowerCase() === result.toLowerCase()
    );
    if (match) return match;
  }

  return categories[0];
}

/**
 * Classifier function that picks the best match from a set of possible categories.
 * Uses OpenAI for classification, with rule-based fallback if the API fails.
 */
export async function identifyP_V_ArtFromOpenAI(
  text: string,
  categories: string[],
  learningContext: Proben[],
  isProbe?: boolean
): Promise<string> {
  // Detect probe vs event from categories if not explicitly passed
  const probeMode = isProbe ?? categories.includes("Ensembleprobe");

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const cleanedContext = learningContext
      .map((c) => ({
        name: c.Bezeichnung,
        group: c.Ensemble_Gruppe,
        category: c.P_V_Art,
      }))
      .filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.name === item.name &&
              t.group === item.group &&
              t.category === item.category
          )
      )
      .slice(-100);

    const systemPrompt = `
You are a classification assistant for an Austrian brass band ("Blasmusik"). You are given text describing a musical event or rehearsal and must pick the SINGLE best category.

Key rules:
- "Vollprobe", "Gesamtprobe", "Generalprobe", "Hauptprobe", "Probenwochenende", "Marschprobe" → "Gesamtorchester Vollprobe"
- "Registerprobe ..." or section rehearsals → "Gesamtorchester Teilprobe"
- "Vorstandssitzung", "Sitzung", "Jahreshauptversammlung" → "Sitzung"
- Youth ensembles like "bildSTARS" → "Ensembleprobe"
- Church events: "Krönung", "Seelensonntag", "Fronleichnam", "Erstkommunion" → "Kirchliche Feierlichkeiten"
- "Wettbewerb", "Wertungsspiel" → "Wettbewerbe/Wertungsspiele"
- "Geburtstag", "Hochzeit" → "Private Anlässe"
- "Konzert" → "Vereinseigene Konzerte"
- "Musikfest", "Unterhaltungsabend", "Christbaumfeier" → "Vereinseigene Musikfeste"
- "Funken", "Faschingsumzug" → "Sonstige Anlässe"
- "Silvesterblasen" → "Öffentliche Anlässe (Gemeinde, Parteien)"
- When unsure, pick the closest category.
`;

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Text: "${text}"\n\nCategories:\n${categories
            .map((c) => `- ${c}`)
            .join("\n")}`,
        },
        {
          role: "user",
          content: `These are old event / category pairs that you can use for learning:\n${cleanedContext
            .map((c) => `- ${c.name} (${c.group}) - ${c.category}`)
            .join("\n")}`,
        },
      ],
      temperature: 0,
      response_format: zodResponseFormat(
        ClassificationResponse,
        "classification"
      ),
    });

    const result = completion.choices[0].message.parsed;

    if (!result) {
      console.warn(
        "No classification result received, using rule-based fallback"
      );
      return classifyByRules(text, categories, probeMode);
    }

    const match = categories.find(
      (cat) => cat.toLowerCase() === result.category.toLowerCase()
    );

    if (match) {
      return match;
    }

    return classifyByRules(text, categories, probeMode);
  } catch (error) {
    console.error("OpenAI error, using rule-based fallback:", (error as Error).message);
    return classifyByRules(text, categories, probeMode);
  }
}
