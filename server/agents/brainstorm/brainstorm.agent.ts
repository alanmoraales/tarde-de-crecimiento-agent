import { generateText } from "ai";
import system from "@/brainstorm.system";
import { google } from "@ai-sdk/google";
import type { Message } from "@/memory.types";

const brainstorm = {
  async generateText({ messages }: { messages: Message[] }) {
    return await generateText({
      model: google("gemini-2.0-flash"),
      system,
      messages,
      onStepFinish: async (step) => {
        // console.log("brainstorm step", step);
      },
    });
  },
};

export default brainstorm;
