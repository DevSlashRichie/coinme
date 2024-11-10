
import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { ObjectIdZod } from "./common";

export interface Transaction {
    _id: ObjectId;
    owner: {
        type: "user" | "business";
        id: ObjectId;
    };
    amount: number;
    description: string;
    category: string;
    createdBy: ObjectId;
    type: "income" | "withdrawal";
    createdAt: Date;
}

const CreateTransactionZod = z.object({
    owner: z.object({
        type: z.enum(["user", "business"]),
        id: ObjectIdZod,
    }),
    amount: z.number().min(0),
    description: z.string().min(1),
    category: z.string().min(1),
    createdBy: ObjectIdZod,
    type: z.enum(["income", "withdrawal"]),
});

export type CreateTransactionType = z.infer<typeof CreateTransactionZod>;

export async function createTransaction(
    create: CreateTransactionType,
    db: Db,
): Promise<Transaction> {
    const cl = db.collection<Transaction>("transactions");
    const data = await CreateTransactionZod.parseAsync(create);
    const r = await cl.insertOne({
        _id: new ObjectId(),
        ...data,
        createdAt: new Date(),
    });
    return {
        _id: r.insertedId,
        ...data,
        createdAt: new Date(),
    };
}

export async function getTransaction(
    input: string,
    db: Db,
): Promise<Transaction | null> {
    const cl = db.collection<Transaction>("transactions");
    const id = await ObjectIdZod.parseAsync(input);
    return cl.findOne({ _id: id });
}

// Get transactions by owner (either user or business)
export async function getOwnerTransactions(
    ownerId: string,
    ownerType: "user" | "business",
    db: Db,
): Promise<Transaction[]> {
    const cl = db.collection<Transaction>("transactions");
    const id = await ObjectIdZod.parseAsync(ownerId);
    return cl
        .find({
            "owner.id": id,
            "owner.type": ownerType,
        })
        .toArray();
}

// Optional: Get transactions by creator
export async function getTransactionsByCreator(
    creatorId: string,
    db: Db,
): Promise<Transaction[]> {
    const cl = db.collection<Transaction>("transactions");
    const id = await ObjectIdZod.parseAsync(creatorId);
    return cl.find({ createdBy: id }).toArray();
}

// Optional: Aggregation to get total balance for an owner
export async function getOwnerBalance(
    ownerId: string,
    ownerType: "user" | "business",
    db: Db,
): Promise<number> {
    const cl = db.collection<Transaction>("transactions");
    const id = await ObjectIdZod.parseAsync(ownerId);

    const result = await cl
        .aggregate([
            {
                $match: {
                    "owner.id": id,
                    "owner.type": ownerType,
                },
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "income"] },
                                "$amount",
                                { $multiply: ["$amount", -1] },
                            ],
                        },
                    },
                },
            },
        ])
        .toArray();

    return result[0]?.total ?? 0;
}
