import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const intentClassificationSchema = z.object({
  intent: z.enum([
    "speaker_follow_up",
    "brainstorm",
    "question_answering",
    "greeting",
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const system = `
    Eres un clasificador de intenciones especializado en analizar mensajes directos para el evento "Tarde de Crecimiento".
    
    Tu trabajo es clasificar cada mensaje en una de estas categorías:
    
    1. **speaker_follow_up**: Mensajes del speaker programado para la próxima charla, respondiendo a preguntas sobre su charla, confirmando disponibilidad, o proporcionando información adicional.
    
    2. **brainstorm**: Mensajes donde el usuario quiere generar ideas, sugerir temas para charlas, explorar nuevos conceptos, o participar en sesiones de lluvia de ideas.
    
    3. **question_answering**: Mensajes donde el usuario hace preguntas específicas sobre charlas anteriores, información del evento, speakers, fechas, o busca información concreta.
    
    4. **greeting**: Mensajes de saludo general, conversación casual, o cuando no está claro qué quiere el usuario.
    
    Analiza el contexto, el tono y el contenido del mensaje para hacer la clasificación más precisa.
    
    Ejemplos:
    - "¿Cuándo fue la charla de React?" → question_answering
    - "Tengo algunas ideas para charlas de IA" → brainstorm  
    - "Hola, ¿cómo estás?" → greeting
    - "Sí, confirmo mi disponibilidad para la charla del viernes" → speaker_follow_up
`;

const intentClassifier = {
  async classifyIntent(
    message: string,
    isFromNextWeekSpeaker: boolean = false
  ) {
    // Si el mensaje viene del speaker de la próxima semana, es muy probable que sea speaker_follow_up
    if (isFromNextWeekSpeaker) {
      return {
        intent: "speaker_follow_up" as const,
        confidence: 0.95,
        reasoning:
          "El mensaje proviene del speaker programado para la próxima charla",
      };
    }

    const result = await generateObject({
      model: google("gemini-2.0-flash"),
      system,
      prompt: `Clasifica la intención de este mensaje: "${message}"`,
      schema: intentClassificationSchema,
    });

    return result.object;
  },
};

export default intentClassifier;
