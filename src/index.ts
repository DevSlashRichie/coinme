import { configDotenv } from "dotenv";
import { Logger } from "./logger";
import { type Db, MongoClient } from "mongodb";
import { Enver } from "@siendoricardo/enver";
import { setupHttpServer } from "./http";

async function setupDb(): Promise<Db> {
    Logger.info("Setting up database...");

    const client = new MongoClient(Enver.getString("MONGO_URI"));
    await client.connect();
    const db = client.db();

    return db;
}

async function main(): Promise<void> {
    configDotenv();

    Logger.info("Initializing application...");

    const db = await setupDb();

    setupHttpServer(Enver.getNumber("PORT", 8585), {
        db,
    });

    Logger.info("Application initialized.");
}

await main();
