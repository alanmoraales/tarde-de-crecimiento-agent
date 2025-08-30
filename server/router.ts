import trpc from "@/trpc";
import memory from "@/memory.service";
import slack from "@/slack.service";
import talkCM from "@/talkCM.agent";
import { z } from "zod";
import talkInfoGatherer from "@/talkInfoGatherer.agent";

const router = trpc.createRouter({
  startNewTalkThread: trpc.publicProcedure.mutation(async () => {
    console.log("Starting new talk thread");
    const initialMessage = "Hola Team, cuál será la charla de esta semana?";
    /**
     * Clear messages to start a new conversation about the next talk
     */
    await memory.clear();
    await memory.addMessages([
      {
        role: "assistant",
        content: initialMessage,
      },
    ]);
    const message = await slack.sendMessageToGrowthSquadChannel(initialMessage);
    console.log("Message sent");
    await memory.setThreadId(message.ts || "");
  }),
  startNextWeeksTalkInformationGathering: trpc.publicProcedure.mutation(
    async () => {
      await memory.clearTalkInfoGathererMemory();
      await memory.addTalkInfoGathererMessages([
        {
          role: "user",
          content:
            "Iniciemos la recolección de información para la próxima charla",
        },
      ]);
      const messages = await memory.getTalkInfoGathererMessages();
      await talkInfoGatherer.generateText({ messages });
    }
  ),
  onNewMessage: trpc.publicProcedure
    // Middleware to debug raw input before parsing
    // .use(async (props) => {
    //   const rawInput = await props.getRawInput();
    //   console.log("New message", rawInput);
    //   return props.next();
    // })
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("url_verification"),
          challenge: z.string(),
        }),
        z.object({
          type: z.literal("event_callback"),
          event: z.object({
            text: z.string(),
            user: z.string(),
            thread_ts: z.string(),
            ts: z.string(),
            channel_type: z.string(),
          }),
        }),
      ])
    )
    .mutation(async ({ input: payload }) => {
      if (payload.type === "url_verification") {
        console.log("URL verification received, returning challenge");
        return payload.challenge;
      }

      console.log("New message", payload.event.text);

      const isMessageFromAgent = slack.isMessageFromAgent(payload.event.user);
      if (isMessageFromAgent) {
        console.log("is a message from the agent, skipping");
        return;
      }

      const isDirectMessage = slack.isDirectMessage(payload.event.channel_type);
      if (isDirectMessage) {
        // is direct message from next week's speaker: follow up information gathering
        const nextWeekTalkSlackUserId =
          await memory.getNextWeekTalkSpeakerSlackId();
        if (nextWeekTalkSlackUserId === payload.event.user) {
          const currentMessages = await memory.getTalkInfoGathererMessages();
          const isNewMessage = currentMessages.every(
            (message) => message.ts !== payload.event.ts
          );
          if (!isNewMessage) {
            console.log("is not a new message, skipping");
            return;
          }
          console.log(
            "is a direct message from the next week's speaker, following up information gathering"
          );
          await memory.addTalkInfoGathererMessages([
            {
              role: "user",
              content: payload.event.text,
              ts: payload.event.ts,
              threadId: payload.event.thread_ts,
            },
            {
              role: "assistant",
              content:
                "He recibido un nuevo mensaje del speaker. Debo revisar el timestamp de los mensajes para responder adecuadamente. El timestamp vendrá en cada mensaje como la propiedad 'ts'. Si no ha pasado mucho tiempo desde el último mensaje, debo seguir la conversación. Si ha pasado mucho tiempo, debo enviar un mensaje de saludo y preguntar por la información que necesito. Debo enviar un único mensaje de respuesta al speaker.",
            },
          ]);
          console.log("payload.event.thread_ts", payload.event.thread_ts);
          const messages = await memory.getTalkInfoGathererMessages();
          await talkInfoGatherer.generateText({
            messages,
            requireToolChoice: true,
            threadId: payload.event.thread_ts,
          });
          return;
        } else {
          // is direct message from any other user: send greeting
          console.log("is a direct message, sending greeting");
          slack.sendDirectMessage(
            payload.event.user,
            payload.event.thread_ts,
            "Hola, soy el agente de la Tarde de Crecimiento. Actualmente no puedo ayudarte mucho más. Ponte en contacto con un organizador."
          );
          return;
        }
      }

      const threadId = await memory.getThreadId();
      const isMessageFromThread = payload.event.thread_ts === threadId;
      if (!isMessageFromThread) {
        console.log("is not a message from the planning thread, skipping");
        return;
      }

      let messages = await memory.getMessages();
      const isNewMessage = messages.every(
        (message) => message.ts !== payload.event.ts
      );
      if (!isNewMessage) {
        console.log("is not a new message, skipping");
        return;
      }

      console.log("is a new message, generating response");
      await memory.addMessages([
        {
          role: "user",
          content: payload.event.text,
          ts: payload.event.ts,
        },
      ]);
      messages = await memory.getMessages();
      const response = await talkCM.generateText({ messages });
      if (response.text) {
        console.log("response generated", response.text);
        await memory.addMessages([
          {
            role: "assistant",
            content: response.text,
          },
        ]);
        await slack.sendMessageToGrowthSquadChannel(response.text, threadId);
      }
    }),
});

export default router;
