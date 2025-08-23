import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export default {
  createRouter: t.router,
  publicProcedure: t.procedure,
};
