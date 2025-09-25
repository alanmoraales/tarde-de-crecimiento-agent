import { generateText } from "ai";
import system from "@/communityInteraction.system";
import { google } from "@ai-sdk/google";
import { tool } from "ai";
import { z } from "zod";
import type { Message } from "@/memory.types";
import slack from "@/slack.service";
import memory from "@/memory.service";
import environment from "@/environment.service";

const communityInteraction = {
  async generateText({
    messages,
    channelId,
    messageTs,
  }: {
    messages: Message[];
    channelId?: string;
    messageTs?: string;
  }) {
    return await generateText({
      model: google("gemini-2.0-flash"),
      system,
      tools: {
        respondToMessage: tool({
          description:
            "Responde a un mensaje en el canal de la comunidad cuando decides que vale la pena responder",
          inputSchema: z.object({
            message: z
              .string()
              .describe("El mensaje de respuesta para la comunidad"),
            reasoning: z
              .string()
              .describe(
                "Explicación de por qué decidiste responder a este mensaje"
              ),
          }),
          execute: async ({ message, reasoning }) => {
            console.log("Community agent decided to respond:", reasoning);

            if (channelId && messageTs) {
              // Send message to the channel in the thread
              await slack.sendMessageToGrowthChannel(message, messageTs);

              // Save assistant response to thread memory
              await memory.addMessagesToThread(
                messageTs,
                [
                  {
                    role: "assistant",
                    content: message,
                    timestamp: (Date.now() / 1000).toString(),
                  },
                ],
                "channel",
                undefined,
                environment.slack.growthChannelId
              );

              return {
                action: "responded",
                message: "Respuesta enviada a la comunidad",
                reasoning,
              };
            }

            return {
              action: "responded",
              message: "Respuesta generada (modo demo)",
              reasoning,
            };
          },
        }),
        skipMessage: tool({
          description:
            "Decide no responder a un mensaje del canal cuando no es apropiado o necesario",
          inputSchema: z.object({
            reasoning: z
              .string()
              .describe(
                "Explicación detallada de por qué decidiste NO responder a este mensaje"
              ),
          }),
          execute: async ({ reasoning }) => {
            console.log("Community agent decided to skip:", reasoning);
            return {
              action: "skipped",
              message: "Mensaje no requiere respuesta",
              reasoning,
            };
          },
        }),
      },
      messages,
      onStepFinish: async (step) => {
        // console.log("community interaction step", step);
      },
    });
  },
};

export default communityInteraction;
