import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

export function multipleMongooseToObject(mongooses) {
  return mongooses.map((mongoose) => mongoose.toObject());
}

export function mongooseToObject(mongoose) {
  return mongoose ? mongoose.toObject() : mongoose;
}
