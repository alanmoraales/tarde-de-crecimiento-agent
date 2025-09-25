import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const channelIntentClassificationSchema = z.object({
  intent: z.enum(["community_interaction", "question_answering"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const system = `
    Eres un clasificador de intenciones especializado en analizar mensajes del canal #tarde-de-crecimiento.
    
    Tu trabajo es clasificar cada mensaje en una de estas dos categorías:
    
    1. **community_interaction**: Mensajes que son parte de la conversación comunitaria, discusiones, intercambio de experiencias, celebraciones, conexiones entre miembros, o conversaciones que pueden beneficiarse de moderación comunitaria.
    
    2. **question_answering**: Mensajes que contienen preguntas específicas que requieren respuestas informativas sobre charlas pasadas, speakers, fechas, contenidos técnicos, o información concreta del evento.
    
    ## Criterios para community_interaction:
    - Discusiones abiertas sobre temas técnicos
    - Intercambio de experiencias personales
    - Celebraciones de logros o participaciones
    - Conversaciones que conectan a diferentes miembros
    - Comentarios sobre charlas que invitan a más discusión
    - Mensajes que pueden beneficiarse de moderación comunitaria
    - Solicitudes de recomendaciones o consejos
    
    ## Criterios para question_answering:
    - Preguntas directas sobre charlas específicas
    - Solicitudes de información sobre fechas, horarios, speakers
    - Preguntas sobre contenidos técnicos específicos de charlas pasadas
    - Consultas sobre el historial del evento
    - Preguntas que requieren datos concretos o estadísticas
    
    ## Ejemplos:
    - "¿Qué les pareció la charla de React de ayer?" → community_interaction
    - "¿Cuándo fue la charla sobre Docker?" → question_answering
    - "Estoy implementando lo que vimos en la charla de testing" → community_interaction
    - "¿Quién dio la charla sobre microservicios?" → question_answering
    - "¿Alguien más tuvo problemas con el setup que mostró María?" → community_interaction
    
    Analiza el contexto, el tono y el contenido del mensaje para hacer la clasificación más precisa.
`;

const channelIntentClassifier = {
  async classifyIntent(message: string) {
    const result = await generateObject({
      model: google("gemini-2.0-flash"),
      system,
      prompt: `Clasifica la intención de este mensaje del canal #tarde-de-crecimiento: "${message}"`,
      schema: channelIntentClassificationSchema,
    });

    return result.object;
  },
};

export default channelIntentClassifier;
