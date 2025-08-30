import { generateText, hasToolCall, StaticToolCall, stepCountIs } from "ai";
import system from "@/talkInfoGatherer.system";
import { google } from "@ai-sdk/google";
import type { Message } from "@/memory.types";
import getTalksPlanning from "@/getTalksPlanning.tool";
import memory from "@/memory.service";
import { ChatPostMessageResponse } from "@slack/web-api";
import slack from "@/slack.service";
import { tool } from "ai";
import { z } from "zod";
import createSendMessageToGrowthSquadTool from "@/sendMessageToGrowthSquad.tool";
import createSendDirectMessageTool from "@/sendDirectMessage.tool";

const talkInfoGatherer = {
  async generateText({
    messages,
    requireToolChoice,
    threadId = "",
  }: {
    messages: Message[];
    requireToolChoice?: boolean;
    threadId?: string;
  }) {
    // console.log("requireToolChoice", requireToolChoice, messages);
    console.log("Generating text for threadId", threadId);
    return await generateText({
      model: google("gemini-2.0-flash"),
      system,
      tools: {
        sendMessageToGrowthSquad: createSendMessageToGrowthSquadTool(threadId),
        sendDirectMessage: createSendDirectMessageTool(threadId),
        getTalksPlanning,
        finishInformationGathering: tool({
          description:
            "Utiliza esta herramienta una vez que ya tengas toda la información de la charla. Esta heramienta: enviará un mensaje de despedida al speaker, y también enviará la información al equipo organizativo.",
          inputSchema: z.object({
            speakerMessage: z
              .string()
              .describe("El mensaje a enviar al speaker"),
            growthSquadMessage: z
              .string()
              .describe(
                "El mensaje a enviar al equipo organizativo con la información de la charla"
              ),
            speakerSlackUserId: z
              .string()
              .describe("El ID del usuario de Slack del speaker"),
          }),
          execute: async ({
            speakerMessage,
            growthSquadMessage,
            speakerSlackUserId,
          }) => {
            await slack.sendMessageToGrowthSquadChannel(growthSquadMessage);
            if (threadId) {
              const messageResponse = await slack.sendDirectMessage(
                speakerSlackUserId,
                threadId,
                speakerMessage
              );
              return {
                message:
                  "El mensaje ha sido enviado al speaker y al equipo organizativo",
                response: messageResponse as ChatPostMessageResponse,
              };
            }
          },
        }),
      },
      messages,
      toolChoice: requireToolChoice ? "required" : "auto",
      stopWhen: [
        hasToolCall("sendDirectMessage"),
        hasToolCall("sendMessageToGrowthSquad"),
        hasToolCall("finishInformationGathering"),
        stepCountIs(5),
      ],
      onStepFinish: async (step) => {
        // console.log("step.content", step.content);
        for (const content of step.content) {
          if (content.type === "text") {
            await memory.addTalkInfoGathererMessages([
              {
                role: "assistant",
                content: content.text,
                // ts: (Date.now() / 1000).toString(),
              },
            ]);
          }
          if (
            content.type === "tool-call" &&
            content.toolName === "sendDirectMessage"
          ) {
            // @todo how to get this typed?
            const messageSent = (content.input as { message: string }).message;
            console.log("messageSent", messageSent);
            await memory.addTalkInfoGathererMessages([
              {
                role: "assistant",
                content: messageSent,
                ts: (Date.now() / 1000).toString(),
              },
            ]);
          }
          // if (
          //   content.type === "tool-result" &&
          //   content.toolName === "sendDirectMessage"
          // ) {
          //   const threadId = (
          //     content.output as { response: ChatPostMessageResponse }
          //   ).response.ts;
          //   console.log("setting threadId", threadId);
          //   await memory.setTalkInfoGathererThreadId(threadId);
          // }
          if (
            content.type === "tool-result" &&
            content.toolName === "sendMessageToGrowthSquad"
          ) {
            const messageForSpeaker = (
              content.output as { response: ChatPostMessageResponse }
            ).response.message;
            await memory.addTalkInfoGathererMessages([
              {
                role: "assistant",
                content: messageForSpeaker.text,
                ts: messageForSpeaker.ts,
              },
            ]);
          }
          if (
            content.type === "tool-result" &&
            content.toolName === "finishInformationGathering"
          ) {
            await memory.clearTalkInfoGathererMemory();
          }
          if (
            content.type === "tool-result" &&
            content.toolName === "getTalksPlanning"
          ) {
            const slackUserId = (content.output as { slackUserId: string }[])[0]
              .slackUserId;
            console.log("talkPlanning", slackUserId);
            if (slackUserId) {
              await memory.setNextWeekTalkSpeakerSlackId(slackUserId);
            }
          }
        }
      },
    });
  },
};

export default talkInfoGatherer;
