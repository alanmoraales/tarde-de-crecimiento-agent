import { tool } from "ai";
import { z } from "zod";

const getTalksPlanning = tool({
  description:
    "Herramienta para obtener el planning de las próximas charlas desde la base de datos de Notion",
  inputSchema: z.object({}),
  execute: async () => {
    /**
     * @todo: Implement this tool with the Notion API
     *
     * For now, we will have a hardcoded value for the next week's talk
     */
    const nextWeekTalkInfo = {
      title: "La ciencia de conseguir grandes cosas",
      speaker: "Alan Morales",
      slackUserId: "U03AGCJQ1FA",
      date: "04/09/2025",
    };
    return [nextWeekTalkInfo];
  },
});

export default getTalksPlanning;
