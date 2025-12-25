import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  isAllergen: { type: Boolean, default: false },
});

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
    },
    image: {
      type: String, // image URL
      required: [true, "Image is required"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    ingredients: [ingredientSchema],
    rating: {
      type: Number,
      default: 0,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    availableDays: {
      type: [
        {
          type: String,
          enum: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
        },
      ],
      default: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      required: true,
    },
  },
  { timestamps: true }
);

itemSchema.index({ availableDays: 1 });

export default mongoose.model("Item", itemSchema);
