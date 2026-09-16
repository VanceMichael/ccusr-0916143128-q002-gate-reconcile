import { databasePath, migrate } from "./db.js";

migrate();
console.log(`数据库已就绪：${databasePath()}`);
