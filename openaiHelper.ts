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
  reasoning: z.string().optional(),
});

/**
 * Classifier function that picks the best match from a set of possible categories
 * using the OpenAI ChatCompletion endpoint with structured output.
 */
export async function identifyP_V_ArtFromOpenAI(
  text: string,
  categories: string[],
  learningContext: Proben[]
): Promise<string> {
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
      );

    const systemPrompt = `
You are a classification assistant. You are given some text describing a musical event or rehearsal.

Instructions:
1. Determine the SINGLE best category from the list.
2. If the name contains "Probe" and nothing like "Register", "Registerprobe", "Registerprobe Hohes Blech" etc., pick "Gesamtorchester Vollprobe" => its the most common category.
3. If unsure, pick the closest category.
4. Provide a confidence score between 0 and 1.
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
          content: `These are old that you should learn from:\n${cleanedContext
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

    // Add null check for result
    if (!result) {
      console.warn(
        "No classification result received, using fallback category"
      );
      return categories[0];
    }

    // Verify that we got a category that exists in our categories array
    const match = categories.find(
      (cat) => cat.toLowerCase() === result.category.toLowerCase()
    );

    if (match) {
      return match;
    }

    // Fallback to first if no valid match
    return categories[0];
  } catch (error) {
    console.error("OpenAI error:", error);
    return categories[0];
  }
}
