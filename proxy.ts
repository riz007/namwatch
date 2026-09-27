import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing.ts";

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|admin|.*\\..*).*)"],
};
