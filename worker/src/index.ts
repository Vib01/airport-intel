import { route } from './api/router';
import { dispatch } from './jobs/dispatch';
import type { Env } from './types';

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    return route(req, env, ctx);
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(dispatch(new Date(event.scheduledTime), env));
  },
} satisfies ExportedHandler<Env>;
