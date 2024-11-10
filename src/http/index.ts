import express from "express";
import { Logger } from "../logger";
import type { State } from "../state";
import cors from "cors";
import { routes } from "./routes";

export function setupHttpServer(port: number, state: State): void {
    const app = express();

    app.use(
        cors({
            origin: "*",
            methods: "*",
            allowedHeaders: "*",
        }),
    );
    app.use(express.json({}));

    app.get("/ping", (_req, res) => {
        res.json({ message: "Pong!" });
    });

    app.use("/", routes(state));

    app.use((req, res, next) => {
        res.status(404).json({ message: "Not found" });
    });

    app.listen(port, () => {
        Logger.info(`Server running on port ${port}`);
    });
}
