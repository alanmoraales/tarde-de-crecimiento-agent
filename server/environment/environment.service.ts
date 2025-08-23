import { z } from "zod";

const environmentSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
  }),
  slack: z.object({
    growthSquadChannelId: z
      .string()
      .min(1, "SLACK_GROWTH_SQUAD_CHANNEL_ID is required"),
    growthChannelId: z
      .string()
      .min(1, "a value for env var SLACK_GROWTH_CHANNEL_ID is required"),
    agentUserId: z
      .string()
      .min(1, "a value for env var SLACK_AGENT_USER_ID is required"),
    agentToken: z
      .string()
      .min(1, "a value for env var SLACK_AGENT_TOKEN is required"),
  }),
  gemini: z.object({
    apiKey: z
      .string()
      .min(1, "a value for env var GOOGLE_GENERATIVE_AI_API_KEY is required"),
  }),
});

type Environment = z.infer<typeof environmentSchema>;

const environment: Environment = {
  server: {
    port: Number(process.env.PORT) || 3000,
  },
  slack: {
    growthSquadChannelId: process.env.SLACK_GROWTH_SQUAD_CHANNEL_ID || "",
    growthChannelId: process.env.SLACK_GROWTH_CHANNEL_ID || "",
    agentUserId: process.env.SLACK_AGENT_USER_ID || "",
    agentToken: process.env.SLACK_AGENT_TOKEN || "",
  },
  gemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  },
};

const validateEnvironment = (environment: Environment) => {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Incorrect environment variables:\n${result.error.issues
        .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}\n\nPlease check your .env file and try again.\n`
    );
  }
  return result.data;
};

export { type Environment, validateEnvironment };
export default environment;
