import { httpRouter } from "convex/server";
import { authComponentClient, createAuth } from "./auth";

const http = httpRouter();

authComponentClient.registerRoutes(http, createAuth);

export default http;
