import trpc from "@/trpc";
import memory from "@/memory.service";
import slack from "@/slack.service";
import talkCM from "@/talkCM.agent";
import brainstorm from "@/brainstorm.agent";
import questionAnswering from "@/questionAnswering.agent";
import intentClassifier from "@/intentClassifier.agent";
import communityInteraction from "@/communityInteraction.agent";
import channelIntentClassifier from "@/channelIntentClassifier.agent";
import environment from "@/environment.service";
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
      await memory.setNextWeekTalkSpeakerSlackId("U03AGCJQ1FA");
      const messages = await memory.getTalkInfoGathererMessages();
      const speakerSlackUserId = await memory.getNextWeekTalkSpeakerSlackId();
      await talkInfoGatherer.generateText({ messages, speakerSlackUserId });
    }
  ),
  onNewMessage: trpc.publicProcedure
    // Middleware to debug raw input before parsing
    .use(async (props) => {
      const rawInput = await props.getRawInput();
      console.log("New message", rawInput);
      return props.next();
    })
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
            thread_ts: z.string().optional(),
            ts: z.string(),
            channel_type: z.string(),
            channel: z.string(),
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
       * Direct messages - Now using LLM-based intent classification
       *
       * This type of messages can trigger the following agents:
       * - Brainstorming
       * - Question answering
       * - Speaker following
       */
      const isDirectMessage = slack.isDirectMessage(payload.event.channel_type);
      console.log("isDirectMessage", isDirectMessage);
      if (isDirectMessage) {
        // Check if message is from next week's speaker
        const nextWeekTalkSlackUserId =
          await memory.getNextWeekTalkSpeakerSlackId();
        const isFromNextWeekSpeaker =
          payload.event.user === nextWeekTalkSlackUserId;

        // Use LLM to classify intent
        const classification = await intentClassifier.classifyIntent(
          payload.event.text,
          isFromNextWeekSpeaker
        );

        console.log("Intent classification:", classification);

        // Execute based on classified intent
        if (classification.intent === "speaker_follow_up") {
          await executeSpeakerFollowUp(payload.event);
          return;
        }

        if (classification.intent === "brainstorm") {
          await executeBrainstorm(payload.event);
          return;
        }

        if (classification.intent === "question_answering") {
          await executeQuestionAnswering(payload.event);
          return;
        }

        if (classification.intent === "greeting") {
          await executeGreeting(payload.event);
          return;
        }
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
      const isMessageFromGrowthSquad =
        payload.event.channel === environment.slack.growthSquadChannelId;
      console.log("isMessageFromGrowthSquad", isMessageFromGrowthSquad);
      if (isMessageFromGrowthSquad) {
        const classification = await classifyGrowthSquadMessage(payload.event);
        console.log("Growth squad message classification:", classification);
        if (classification === "talk_announcement") {
          await executeTalkAnnouncement(payload.event);
          return;
        }
      }

      /**
       * Messages from #tarde-de-crecimiento channel
       *
       * This type of messages can trigger the following agents:
       * - Question answering
       * - Community interaction
       */
      const isMessageFromGrowthChannel =
        payload.event.channel === environment.slack.growthChannelId;
      console.log("isMessageFromGrowthChannel", isMessageFromGrowthChannel);
      if (isMessageFromGrowthChannel) {
        const channelClassification =
          await channelIntentClassifier.classifyIntent(payload.event.text);
        console.log(
          "Growth channel intent classification:",
          channelClassification
        );

        if (channelClassification.intent === "community_interaction") {
          await executeCommunityInteraction(payload.event);
          return;
        }

        if (channelClassification.intent === "question_answering") {
          await executeChannelQuestionAnswering(payload.event);
          return;
        }
      }
    }),
});

// Helper function to get the correct thread_ts for responses
const getThreadTs = (event: { thread_ts?: string; ts: string }) => {
  // If there's already a thread_ts, use it (this is a reply in an existing thread)
  // If not, use the message ts (this will create a new thread from the original message)
  return event.thread_ts || event.ts;
};

const executeSpeakerFollowUp = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  /**
   * We need to check if the message is new to avoid responding more than once to the same message
   *
   * @todo create a global guard to check if the message is new
   * and avoid duplicating the code for each agent
   */
  const threadTs = getThreadTs(event);
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
  ]);
  const messages = await memory.getTalkInfoGathererMessages();
  const speakerSlackUserId = await memory.getNextWeekTalkSpeakerSlackId();
  await talkInfoGatherer.generateText({
    messages,
    requireToolChoice: true,
    threadId: threadTs,
    speakerSlackUserId,
  });
  return;
};

const executeGreeting = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Sending greeting");

  const threadTs = getThreadTs(event);

  /**
   * Check if the message is new to avoid responding more than once to the same message
   */
  const isNewMessage = await memory.isMessageNew(threadTs, event.ts);
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }

  const greetingMessage = `¡Hola! 👋 Soy el agente de **Tarde de Crecimiento**.

🚧 **Actualmente estoy en modo DEMO** y puedo ayudarte con diferentes tipos de consultas:

🧠 **Modo Brainstorm** - Para generar ideas de charlas:
• "Tengo algunas ideas para charlas de IA"
• "¿Qué temas podrían ser interesantes para el equipo?"
• "Ayúdame a pensar en charlas sobre desarrollo"

❓ **Modo Question & Answer** - Para responder preguntas:
• "¿Cuándo fue la última charla de React?"
• "¿Quién ha dado charlas sobre arquitectura?"
• "¿Qué temas se han cubierto este año?"

💬 **Prueba enviándome un mensaje** y verás cómo clasifico automáticamente tu intención y activo el modo correspondiente.

Para consultas más complejas, puedes contactar con un organizador.`;

  // Add user message to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "user",
        content: event.text,
        timestamp: event.ts,
        slackUserId: event.user,
      },
    ],
    "direct",
    event.user
  );

  // Send greeting response
  await slack.sendDirectMessage(event.user, threadTs, greetingMessage);

  // Add assistant response to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "assistant",
        content: greetingMessage,
        timestamp: (Date.now() / 1000).toString(),
      },
    ],
    "direct",
    event.user
  );
};

const executeBrainstorm = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Executing brainstorm agent");

  const threadTs = getThreadTs(event);

  /**
   * Check if the message is new to avoid responding more than once to the same message
   */
  const isNewMessage = await memory.isMessageNew(threadTs, event.ts);
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }

  // Add user message to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "user",
        content: event.text,
        timestamp: event.ts,
        slackUserId: event.user,
      },
    ],
    "direct",
    event.user
  );

  // Get thread messages for context
  const threadMessages = await memory.getThreadMessages(threadTs);

  const response = await brainstorm.generateText({
    messages: threadMessages,
  });

  if (response.text) {
    // Send response to Slack
    await slack.sendDirectMessage(event.user, threadTs, response.text);

    // Add assistant response to thread
    await memory.addMessagesToThread(
      threadTs,
      [
        {
          role: "assistant",
          content: response.text,
          timestamp: (Date.now() / 1000).toString(),
        },
      ],
      "direct",
      event.user
    );
  }
};

const executeQuestionAnswering = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Executing question answering agent");

  const threadTs = getThreadTs(event);

  /**
   * Check if the message is new to avoid responding more than once to the same message
   */
  const isNewMessage = await memory.isMessageNew(threadTs, event.ts);
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }

  // Add user message to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "user",
        content: event.text,
        timestamp: event.ts,
        slackUserId: event.user,
      },
    ],
    "direct",
    event.user
  );

  // Get thread messages for context
  const threadMessages = await memory.getThreadMessages(threadTs);

  const response = await questionAnswering.generateText({
    messages: threadMessages,
  });

  if (response.text) {
    // Send response to Slack
    await slack.sendDirectMessage(event.user, threadTs, response.text);

    // Add assistant response to thread
    await memory.addMessagesToThread(
      threadTs,
      [
        {
          role: "assistant",
          content: response.text,
          timestamp: (Date.now() / 1000).toString(),
        },
      ],
      "direct",
      event.user
    );
  }
};

const classifyGrowthSquadMessage = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  const planningThreadId = await memory.getThreadId();
  const threadTs = getThreadTs(event);
  const isMessageFromPlanningThread = threadTs === planningThreadId;
  if (isMessageFromPlanningThread) {
    return "talk_announcement";
  }

  return "speaker_follow_up";
};

const executeTalkAnnouncement = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
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

const executeCommunityInteraction = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Executing community interaction agent");

  const threadTs = getThreadTs(event);

  /**
   * Check if the message is new to avoid responding more than once to the same message
   */
  const isNewMessage = await memory.isMessageNew(threadTs, event.ts);
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }

  // Add user message to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "user",
        content: event.text,
        timestamp: event.ts,
        slackUserId: event.user,
      },
    ],
    "channel",
    undefined,
    environment.slack.growthChannelId
  );

  // Get thread messages for context
  const threadMessages = await memory.getThreadMessages(threadTs);

  const response = await communityInteraction.generateText({
    messages: threadMessages,
    channelId: environment.slack.growthChannelId,
    messageTs: threadTs,
  });

  // The community interaction agent handles its own response logic through tools
  console.log("Community interaction agent finished processing");
};

const executeChannelQuestionAnswering = async (event: {
  text: string;
  user: string;
  thread_ts?: string;
  ts: string;
  channel_type: string;
}) => {
  console.log("Executing question answering agent for channel message");

  const threadTs = getThreadTs(event);

  /**
   * Check if the message is new to avoid responding more than once to the same message
   */
  const isNewMessage = await memory.isMessageNew(threadTs, event.ts);
  if (!isNewMessage) {
    console.log("is not a new message, skipping");
    return;
  }

  // Add user message to thread
  await memory.addMessagesToThread(
    threadTs,
    [
      {
        role: "user",
        content: event.text,
        timestamp: event.ts,
        slackUserId: event.user,
      },
    ],
    "channel",
    undefined,
    environment.slack.growthChannelId
  );

  // Get thread messages for context
  const threadMessages = await memory.getThreadMessages(threadTs);

  const response = await questionAnswering.generateText({
    messages: threadMessages,
  });

  if (response.text) {
    // Send response to the channel in the thread
    await slack.sendMessageToGrowthChannel(response.text, threadTs);

    // Add assistant response to thread
    await memory.addMessagesToThread(
      threadTs,
      [
        {
          role: "assistant",
          content: response.text,
          timestamp: (Date.now() / 1000).toString(),
        },
      ],
      "channel",
      undefined,
      environment.slack.growthChannelId
    );
  }
};

export default router;
