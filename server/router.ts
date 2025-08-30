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
      /**
       * URL verification for Slack webhook
       * This is a challenge used by Slack to verify the webhook is working
       */
      if (payload.type === "url_verification") {
        console.log("URL verification received, returning challenge");
        return payload.challenge;
      }

      /**
       * Any other type is a message from Slack
       */
      console.log("New message", payload.event.text);

      /**
       * Slack sends messages send by the agent, we don't need to process them
       */
      const isMessageFromAgent = slack.isMessageFromAgent(payload.event.user);
      if (isMessageFromAgent) {
        console.log("is a message from the agent, skipping");
        return;
      }

      /**
       * Now, we are going to classify the message by its intention,
       * then we will pass the message to the appropriate agent.
       *
       * The first part of this classification is manual, and the second part is done by an llm.
       */

      /**
       * Direct messages
       *
       * This type of messages can trigger the following agents:
       * - Brainstorming
       * - Question answering
       * - Speaker following
       */
      const isDirectMessage = slack.isDirectMessage(payload.event.channel_type);
      if (isDirectMessage) {
        const classification = await classifyDirectMessage(payload.event);
        console.log("classification", classification);

        if (classification === "greeting") {
          await executeGreeting(payload.event);
          return;
        }

        if (classification === "speaker_follow_up") {
          await executeSpeakerFollowUp(payload.event);
          return;
        }
        return;
      }

      /**
       * Messages from #crecimiento-squad channel
       *
       * This type of messages can trigger the following agents:
       * - Speaker following
       * - Talk Announcement
       *
       * For now, all messages that are not direct will be considered as messages from the growth squad channel
       * @todo implement speaker following
       */
      const classification = await classifyGrowthSquadMessage(payload.event);
      if (classification === "talk_announcement") {
        await executeTalkAnnouncement(payload.event);
        return;
      }

      /**
       * Messages from #tarde-de-crecimiento channel
       *
       * This type of messages can trigger the following agents:
       * - Question answering
       * - Community interaction
       *
       * @todo implement this agents
       */
    }),
});

const classifyDirectMessage = async (event: {
  text: string;
  user: string;
  thread_ts: string;
  ts: string;
  channel_type: string;
}) => {
  const nextWeekTalkSlackUserId = await memory.getNextWeekTalkSpeakerSlackId();
  const isNextWeekTalkSpeaker = event.user === nextWeekTalkSlackUserId;
  if (isNextWeekTalkSpeaker) {
    return "speaker_follow_up";
  }
  return "greeting";
};

const executeSpeakerFollowUp = async (event: {
  text: string;
  user: string;
  thread_ts: string;
  ts: string;
  channel_type: string;
}) => {
  /**
   * We need to check if the message is new to avoid responding more than once to the same message
   *
   * @todo create a global guard to check if the message is new
   * and avoid duplicating the code for each agent
   */
  const currentMessages = await memory.getTalkInfoGathererMessages();
  const isNewMessage = currentMessages.every(
    (message) => message.timestamp !== event.ts
  );
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }
  // -----------------------------

  console.log(
    "is a direct message from the next week's speaker, following up information gathering"
  );
  await memory.addTalkInfoGathererMessages([
    {
      role: "user",
      content: event.text,
      timestamp: event.ts,
    },
    {
      role: "assistant",
      content:
        "He recibido un nuevo mensaje del speaker. Debo revisar el timestamp de los mensajes para responder adecuadamente. El timestamp vendrá en cada mensaje como la propiedad 'ts'. Si no ha pasado mucho tiempo desde el último mensaje, debo seguir la conversación. Si ha pasado mucho tiempo, debo enviar un mensaje de saludo y preguntar por la información que necesito. Debo enviar un único mensaje de respuesta al speaker.",
    },
  ]);
  const messages = await memory.getTalkInfoGathererMessages();
  await talkInfoGatherer.generateText({
    messages,
    requireToolChoice: true,
    threadId: event.thread_ts,
  });
  return;
};

const executeGreeting = async (event: {
  text: string;
  user: string;
  thread_ts: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Sending greeting");
  await slack.sendDirectMessage(
    event.user,
    event.thread_ts,
    "Hola, soy el agente de la Tarde de Crecimiento. Actualmente no puedo ayudarte mucho más. Ponte en contacto con un organizador."
  );
};

const classifyGrowthSquadMessage = async (event: {
  text: string;
  user: string;
  thread_ts: string;
  ts: string;
  channel_type: string;
}) => {
  const planningThreadId = await memory.getThreadId();
  const isMessageFromPlanningThread = event.thread_ts === planningThreadId;
  if (isMessageFromPlanningThread) {
    return "talk_announcement";
  }

  return "speaker_follow_up";
};

const executeTalkAnnouncement = async (event: {
  text: string;
  user: string;
  thread_ts: string;
  ts: string;
  channel_type: string;
}) => {
  /**
   * We need to check if the message is new to avoid responding more than once to the same message
   *
   * @todo create a global guard to check if the message is new
   * and avoid duplicating the code for each agent
   */
  let messages = await memory.getMessages();
  const isNewMessage = messages.every(
    (message) => message.timestamp !== event.ts
  );
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }
  // -----------------------------

  console.log("is a new message, generating response");
  await memory.addMessages([
    {
      role: "user",
      content: event.text,
      timestamp: event.ts,
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
    const threadId = await memory.getThreadId();
    await slack.sendMessageToGrowthSquadChannel(response.text, threadId);
  }
};

export default router;
