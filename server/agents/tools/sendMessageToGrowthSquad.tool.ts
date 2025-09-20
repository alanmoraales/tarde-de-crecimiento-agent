import slack from "@/slack.service";
import { ChatPostMessageResponse } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const createSendMessageToGrowthSquadTool = (
  threadId?: string,
  speakerSlackUserId?: string
) =>
  tool({
    description:
      "Herramienta para enviar un mensaje al equipo organizativo de Tarde de Crecimiento.",
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "El mensaje a enviar al equipo organizativo de Tarde de Crecimiento."
        ),
      messageForSpeaker: z
        .string()
        .describe(
          "El mensaje a enviar al speaker de la charla. Este mensaje se enviará al speaker después de que se haya enviado el mensaje a la squad de Growth. Este mensaje es para informarle al speaker que se ha enviado un mensaje al equipo organizativo"
        ),
    }),
    execute: async ({ message, messageForSpeaker }) => {
      await slack.sendMessageToGrowthSquadChannel(message);
      if (threadId) {
        const messageForSpeakerResponse = await slack.sendDirectMessage(
          speakerSlackUserId || "",
          threadId,
          messageForSpeaker
        );
        return {
          message: "El mensaje ha sido enviado a la squad de Growth",
          response: messageForSpeakerResponse as ChatPostMessageResponse,
        };
      }
    },
  });

export default createSendMessageToGrowthSquadTool;
