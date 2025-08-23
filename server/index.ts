import { publicProcedure, router } from "./trpc";
import { WebClient } from "@slack/web-api";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import {
  addMessages,
  clearMemory,
  getMessages,
  getThreadId,
  setThreadId,
} from "./memory";
import { generateText, tool } from "ai";
import { google } from "@ai-sdk/google";
import system from "./system";
import { z } from "zod";

const slack = new WebClient(process.env.SLACK_TOKEN);

const appRouter = router({
  hello: publicProcedure.query(() => "Hello World"),
  startNewTalkThread: publicProcedure.mutation(async () => {
    console.log("Starting new talk thread");
    const initialMessage = "Hola Team, cuál será la charla de esta semana?";
    /**
     * Clear messages to start a new conversation about the next talk
     */
    await clearMemory();
    await addMessages([
      {
        role: "assistant",
        content: initialMessage,
      },
    ]);
    const message = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID || "",
      text: initialMessage,
    });
    console.log("Message sent", message);
    await setThreadId(message.ts || "");
  }),
  /**
   * Receive slack messages
   * Can receive a challenge callback
   * 
   * {
    "token": "Jhj5dZrVaK7ZwHHjRyZWjbDl",
    "challenge": "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P",
    "type": "url_verification"
    }
   */
  newMessage: publicProcedure.mutation(async ({ getRawInput }) => {
    const payload = await getRawInput();
    console.log("New message", payload.event.text);
    if (payload.type === "url_verification") {
      return payload.challenge;
    }
    const isMessageFromAgent =
      payload.event.user === process.env.SLACK_APP_USER;
    console.log("isMessageFromAgent", isMessageFromAgent);
    if (isMessageFromAgent) {
      return "Message received";
    }
    const threadId = await getThreadId();
    const isMessageFromThread = payload.event.thread_ts === threadId;
    console.log("isMessageFromThread", isMessageFromThread);
    if (!isMessageFromThread) {
      return "Message received";
    }
    let messages = await getMessages();
    const isNewMessage = messages.every(
      (message) => message.ts !== payload.event.ts
    );
    console.log("isNewMessage", isNewMessage);
    if (!isNewMessage) {
      return "Message received";
    }
    await addMessages([
      {
        role: "user",
        content: payload.event.text,
        ts: payload.event.ts,
      },
    ]);
    messages = await getMessages();
    const response = await generateText({
      model: google("gemini-2.0-flash"),
      system,
      messages,
      tools: {
        announceTalk: tool({
          description:
            "Herramienta para anunciar una charla en el canal de Slack una vez que se ha generado el mensaje de anuncio",
          inputSchema: z.object({
            message: z
              .string()
              .describe(
                "El mensaje de anuncio de la charla formateado en markdown"
              ),
          }),
          execute: async ({ message }) => {
            await slack.chat.postMessage({
              channel: process.env.SLACK_CHANNEL_ID || "",
              markdown_text: message,
            });
            /**
             * After announcing the talk, we need to clear the memory
             * a new conversation will be started next week
             * we also want to send a message to the thread to inform that the talk has been announced
             * and that the conversation is over
             *
             * how to do this by letting the llm generate the message? maybe with another step?
             * letting the llm run by 2 steps
             */
            return {
              message: "La charla ha sido anunciada",
            };
          },
        }),
      },
      onStepFinish: async (step) => {
        console.log("step", step);
      },
    });
    console.log("gemini response", response);
    if (response.text) {
      await addMessages([
        {
          role: "assistant",
          content: response.text,
        },
      ]);
      await slack.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID || "",
        text: response.text,
        thread_ts: threadId,
      });
    }
    return "Message received";
  }),
});

const server = createHTTPServer({
  router: appRouter,
});

console.log("Server is running on port", process.env.PORT || 3000);
server.listen(process.env.PORT || 3000);

export type AppRouter = typeof appRouter;
