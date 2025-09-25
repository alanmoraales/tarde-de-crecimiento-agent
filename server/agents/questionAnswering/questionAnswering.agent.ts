import { generateText } from "ai";
import system from "@/questionAnswering.system";
import { google } from "@ai-sdk/google";
import type { Message } from "@/memory.types";

const questionAnswering = {
  async generateText({ messages }: { messages: Message[] }) {
    return await generateText({
      model: google("gemini-2.0-flash"),
      system,
      messages,
      onStepFinish: async (step) => {
        // console.log("question answering step", step);
      },
    });
  },
};

export default questionAnswering;
