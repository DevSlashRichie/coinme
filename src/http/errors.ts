import type express from "express";
import { ApiError } from "../api/api-error";

export function processApiError(error: unknown, res: express.Response): void {
  if (error instanceof ApiError) {
    res.status(error.httpCode).json({ error: error.message });
  } else if (error instanceof Error) {
    res.status(500).json({ error: 
      typeof error.message === "string" ? error.message : error
    });
  } else {
    res.status(500).json({ error: "Unknown error: " + String(error) });
  }
}

export function pae(res: express.Response) {
  return (e: unknown) => processApiError(e, res);
}
