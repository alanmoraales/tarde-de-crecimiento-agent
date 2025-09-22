import slack from "@/slack.service";
import { tool } from "ai";
import { z } from "zod";

const announceTalk = tool({
  description:
    "Herramienta para anunciar una charla en el canal de Slack una vez que se ha generado el mensaje de anuncio",
  inputSchema: z.object({
    message: z
      .string()
      .describe("El mensaje de anuncio de la charla formateado en markdown"),
  }),
  execute: async ({ message }) => {
    console.log("announceTalk tool called");
    await slack.sendMessageToGrowthChannel(message);
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
});

export default announceTalk;
