import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../src/config/db.js";
import Item from "../src/models/item.model.js";

dotenv.config();

const DEFAULT_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_SYNONYMS = {
  sunday: "sun",
  sun: "sun",
  monday: "mon",
  mon: "mon",
  tuesday: "tue",
  tue: "tue",
  wednesday: "wed",
  wed: "wed",
  thursday: "thu",
  thu: "thu",
  friday: "fri",
  fri: "fri",
  saturday: "sat",
  sat: "sat",
};

const normalizeDays = (days = []) => {
  const mapped = (days || [])
    .map((d) => (d ? DAY_SYNONYMS[d.toString().toLowerCase().trim()] : null))
    .filter(Boolean);
  return mapped.length ? Array.from(new Set(mapped)) : DEFAULT_DAYS;
};

const run = async () => {
  try {
    await connectDB();

    // 1) Normalize existing values
    const cursor = Item.find({}, { availableDays: 1 }).cursor();
    let updatedCount = 0;
    for await (const doc of cursor) {
      const current = Array.isArray(doc.availableDays)
        ? doc.availableDays
        : [];
      const normalized = normalizeDays(current);
      const needsUpdate =
        current.length !== normalized.length ||
        normalized.some((d, idx) => current[idx] !== d);
      if (needsUpdate) {
        await Item.updateOne(
          { _id: doc._id },
          { $set: { availableDays: normalized } }
        );
        updatedCount += 1;
      }
    }

    // 2) Fill missing/empty
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
      `Backfill complete. Normalized ${updatedCount}. Matched ${result.matchedCount}, modified ${result.modifiedCount}.`
    );
  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    await mongoose.connection.close();
  }
};

run();
