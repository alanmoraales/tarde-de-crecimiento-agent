import { generateText } from "ai";
import system from "@/talkCM.system";
import { google } from "@ai-sdk/google";
import announceTalk from "@/announceTalk.tool";
import type { Message } from "@/memory.types";

const talkCM = {
  async generateText({ messages }: { messages: Message[] }) {
    return await generateText({
      model: google("gemini-2.0-flash"),
      system,
      tools: {
        announceTalk,
      },
      messages,
      onStepFinish: async (step) => {
        console.log("step", step);
      },
    });
  },
};

export default talkCM;
