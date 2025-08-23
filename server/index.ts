import router from "@/router";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import environment, { validateEnvironment } from "@/environment.service";

validateEnvironment(environment);

const server = createHTTPServer({
  router,
});

console.log("Server running on port", environment.server.port);
server.listen(environment.server.port);
