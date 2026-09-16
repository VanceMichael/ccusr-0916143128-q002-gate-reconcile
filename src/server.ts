import { buildApp } from "./app.js";
import { databasePath } from "./db.js";

const app = buildApp(databasePath());
const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
