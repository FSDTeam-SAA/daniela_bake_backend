import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import Item from "../src/models/item.model.js";

dotenv.config();

const DEFAULT_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const run = async () => {
  try {
    await connectDB();

    const result = await Item.updateMany(
      {
        $or: [
          { availableDays: { $exists: false } },
          { availableDays: { $size: 0 } },
        ],
      },
      { $set: { availableDays: DEFAULT_DAYS } }
    );

    console.log(
      `Backfill complete. Matched ${result.matchedCount}, modified ${result.modifiedCount}.`
    );
  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    await mongoose.connection.close();
  }
};

run();
