import slack from "@/slack.service";
import { ChatPostMessageResponse } from "@slack/web-api";
import { tool } from "ai";
import { z } from "zod";

const createSendDirectMessageTool = (threadId?: string) => {
  console.log("Creating sendDirectMessage tool with threadId", threadId);
  return tool({
    description:
      "Herramienta para enviar un mensaje directo a un usuario de Slack",
    inputSchema: z.object({
      message: z.string().describe("El mensaje a enviar al usuario de Slack."),
      userId: z
        .string()
        .describe(
          "El ID del usuario de Slack a quien se le enviará el mensaje."
        ),
    }),
    execute: async ({ message, userId }) => {
      console.log("Executing sendDirectMessage tool with threadId", threadId);
      let messageResponse = {};
      // de hecho podeemos combinar ambos casos, porque la función post message del sdk de Slack ya maneja el caso de que el threadId no exista
      if (!threadId) {
        console.log("Sending new direct message");
        messageResponse = await slack.sendNewDirectMessage(userId, message);
      } else {
        console.log("Sending direct message to threadId", threadId);
        messageResponse = await slack.sendDirectMessage(
          userId,
          threadId,
          message
        );
      }
      return {
        message: "El mensaje ha sido enviado al usuario de Slack",
        response: messageResponse as ChatPostMessageResponse,
      };
    },
  });
};

export default createSendDirectMessageTool;
