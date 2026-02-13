/**
 * Gemini AI - Bridge Service
 * Calls Main Process via IPC to bypass Renderer CSP (Content Security Policy)
 */

const SYSTEM_INSTRUCTION = `
You are an expert Lighting Designer for BeamStudio, a DMX lighting control system.
Your goal is to generate immersive lighting scenes based on the provided Context (Music, Weather, Time, Location).

You control 3 lighting zones:
1. LEFT (Mids/Highs focus)
2. CENTER (Bass focus)
3. RIGHT (Mids/Highs focus)

Your output must be a strictly valid JSON object. Do not include markdown formatting (like \`\`\`json).
The JSON must follow one of these two schemas:

SCHEMA A: DYNAMIC SCENE (Code-based, Audio Reactive)
{
  "type": "DYNAMIC",
  "name": "Scene Name",
  "icon": "Emoji",
  "description": "Short explanation of the vibe",
  "code": "JavaScript function body string"
}

SCHEMA B: FLAG (Static Colors)
{
  "type": "FLAG",
  "name": "Flag Name",
  "colors": [
    { "r": 0-255, "g": 0-255, "b": 0-255 }, // Left
    { "r": 0-255, "g": 0-255, "b": 0-255 }, // Center
    { "r": 0-255, "g": 0-255, "b": 0-255 }  // Right
  ]
}

### CRITICAL RULES FOR DYNAMIC SCENES:
1. You must write a JavaScript function body for: 
   getFrame(t, bass, hslToRgb)
   - t: Time in milliseconds.
   - bass: Audio energy level (0.0 to 1.0).
   - hslToRgb: Helper function (h: 0-360, s: 0-100, l: 0-100) -> {r,g,b}
   
2. BRIGHTNESS FLOOR MATH:
   To ensure the lights never turn off completely (maintaining a 40% floor), you MUST use this formula for lightness/intensity:
   const intensity = 0.4 + (bass * 0.6);
   Or for more sensitivity control if needed:
   const l = 40 + (bass * 60); (Lightness 40-100%)

3. Return Format:
   The code must return an array of 3 color objects: [{r,g,b}, {r,g,b}, {r,g,b}] (Left, Center, Right).

### CONTEXT:
Location: Córdoba, Argentina
Weather: 22°C, Noche parcialmente nublada
Wind: 7 mph from North
Time: 23:24
`

/**
 * Generates a lighting scene based on context.
 * @param {string} userPrompt - Optional user intention (e.g., "Surprise me", "Angry rock")
 * @returns {Promise<object>} - The generated scene JSON
 */
export async function generateLightScene(userPrompt = "Surprise me") {
  const MAX_RETRIES = 2
  let attempt = 0

  while (attempt <= MAX_RETRIES) {
    try {
      const apiKey = localStorage.getItem('RENDERER_VITE_GEMINI_API_KEY') || ''
      const modelName = localStorage.getItem('RENDERER_VITE_GEMINI_MODEL') || "models/gemini-1.5-flash"

      if (!apiKey) throw new Error("Gemini API Key missing. Please configure it in System settings.")

      // 1. Get System Media Context (from renderer bridge)
      const media = await window.dmx?.getSystemMedia()
      const mediaText = media ? `Now Playing: "${media.title}" by ${media.artist}` : "No music playing"

      // 2. Build Prompt
      const prompt = `
          CURRENT CONTEXT:
          ${mediaText}
          User Request: "${userPrompt}"
          
          Generate a lighting scene that perfectly matches this vibe.
          ${attempt > 0 ? `(ATTEMPT ${attempt + 1}: PREVIOUS RESPONSE WAS INVALID JSON. PLEASE ENSURE STRICT JSON FORMAT.)` : ''}
          `

      // 3. Call Main Process via Bridge (Offloads network request to Main process to bypass CSP)
      const responseText = await window.ai.generate(apiKey, modelName, prompt, SYSTEM_INSTRUCTION)

      // 4. Parse JSON
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()

      try {
        return JSON.parse(cleanJson)
      } catch (parseError) {
        console.warn(`Attempt ${attempt + 1} failed to parse JSON:`, cleanJson)
        // Throwing here to trigger the retry catch block
        throw new Error("Invalid JSON response from AI")
      }

    } catch (error) {
      console.error(`AI Generation Attempt ${attempt + 1} Failed:`, error)
      attempt++

      // If we've run out of retries, throw the final error
      if (attempt > MAX_RETRIES) {
        throw error
      }

      // Verification: Small delay before retry? Not strictly necessary but good practice.
    }
  }
}

/**
 * Tests the connection to Gemini.
 */
export async function testConnection() {
  try {
    const apiKey = localStorage.getItem('RENDERER_VITE_GEMINI_API_KEY') || ''
    const modelName = localStorage.getItem('RENDERER_VITE_GEMINI_MODEL') || "models/gemini-1.5-flash"

    if (!apiKey) throw new Error("No API Key configured")

    const response = await window.ai.test(apiKey, modelName)

    if (response.toUpperCase().includes('OK')) return true
    throw new Error("Unexpected response from AI")
  } catch (error) {
    console.error("AI Connection Test Failed:", error)
    throw error
  }
}
