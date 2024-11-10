import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { ObjectIdZod } from "./common";

export interface Business {
    _id: ObjectId;
    name: string;

    userAdminId: ObjectId;

    members: ObjectId[];
}

const CreateBusinessZod = z.object({
    name: z.string().min(1),
    userAdminId: ObjectIdZod,
});

export type CreateBusinessType = z.infer<typeof CreateBusinessZod>;

export async function createBusiness(
    create: CreateBusinessType,
    db: Db,
): Promise<Business> {
    const cl = db.collection<Business>("businesses");

    const data = await CreateBusinessZod.parseAsync(create);
    const r = await cl.insertOne({
        _id: new ObjectId(),
        members: [],
        ...data,
    });

    return {
        _id: r.insertedId,
        name: create.name,
        userAdminId: create.userAdminId,
        members: [],
    };
}

export async function getBusiness(
    input: string,
    db: Db,
): Promise<Business | null> {
    const cl = db.collection<Business>("businesses");

    const id = await ObjectIdZod.parseAsync(input);

    return cl.findOne({ _id: id });
}

const AddBusinessMemberZod = z.object({
    businessId: ObjectIdZod,
    userId: ObjectIdZod,
});

export async function addBusinessMember(
    input: {
        businessId: string;
        userId: string;
    },
    db: Db,
): Promise<void> {
    const cl = db.collection<Business>("businesses");

    const data = await AddBusinessMemberZod.parseAsync(input);

    await cl.updateOne(
        { _id: data.businessId },
        {
            $push: {
                members: data.userId,
            },
        },
    );
}
