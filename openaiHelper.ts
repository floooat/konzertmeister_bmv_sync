import OpenAI from "openai";
import dotenv from "dotenv";

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

/**
 * Classifier function that picks the best match from a set of possible categories
 * using the OpenAI ChatCompletion endpoint, returning JSON.
 */
export async function identifyP_V_ArtFromOpenAI(
  text: string,
  categories: string[]
): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("text", text);
    // Construct a system prompt that forces a JSON-only output
    const systemPrompt = `
You are a classification assistant. You are given some text describing a musical event or rehearsal:
"${text}"

You have these possible categories:
${categories.map((c) => `- ${c}`).join("\n")}

Instructions:
1. Determine the SINGLE best category from the list.
2. Output ONLY valid JSON with the key "category". Example:
{"category": "Sonstige Anlässe"}

3. Do not include extra text or keys beyond {"category": "..."}.
4. If the name contains "Probe" and nothing like "Register", "Registerprobe", "Registerprobe Hohes Blech" etc., pick "Gesamtorchester Vollprobe" => its the most common category.
5. If unsure, pick the closest category.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";

    // Attempt to parse the returned JSON
    let parsedCategory: string | null = null;
    try {
      const json = JSON.parse(raw);
      if (typeof json.category === "string") {
        parsedCategory = json.category.trim();
      }
    } catch (parseErr) {
      console.warn("Could not parse structured JSON from OpenAI:", parseErr);
    }

    // Verify that we got a category that exists in our categories array
    if (parsedCategory) {
      // Make case-insensitive check to see if it matches
      const match = categories.find(
        (cat) => cat.toLowerCase() === parsedCategory!.toLowerCase()
      );
      if (match) {
        return match;
      }
    }

    // Fallback to first if no valid match
    return categories[0];
  } catch (error) {
    console.error("OpenAI error:", error);
    return categories[0];
  }
}
