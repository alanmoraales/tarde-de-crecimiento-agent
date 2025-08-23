import trpc from "@/trpc";
import memory from "@/memory.service";
import slack from "@/slack.service";
import talkCM from "@/talkCM.agent";
import { z } from "zod";

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
    console.log("Message sent", message);
    await memory.setThreadId(message.ts || "");
  }),
  newMessage: trpc.publicProcedure
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
