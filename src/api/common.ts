import { ObjectId } from "mongodb";
import { z } from "zod";

const REGEX = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i;

export const ObjectIdZod = z.union([
    z
        .string()
        .regex(REGEX)
        .transform((v) => new ObjectId(v)),
    z.instanceof(ObjectId),
]);

export type ObjectIdZodType = z.infer<typeof ObjectIdZod>;

export const DateAsString = z
    .string()
    .or(z.null())
    .default(null)
    .transform((d) => {
        if (!d) return null;
        return new Date(d);
    });

export type DateAsStringType = z.infer<typeof DateAsString>;
