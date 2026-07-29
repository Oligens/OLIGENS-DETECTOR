import { createStart, createMiddleware } from "@tanstack/react-start";
import { handleAuthApiRequest } from "./server/auth";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth")) {
      return await handleAuthApiRequest(request);
    }
  } catch (err) {
    console.error("authMiddleware error", err);
    return new Response(null, { status: 500 });
  }
  return await next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [authMiddleware, errorMiddleware],
}));
