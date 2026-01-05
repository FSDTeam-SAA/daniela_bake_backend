import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
    },
    image: {
      type: String,
      required: [true, "Category image is required"],
    },
    bgColor: {
      type: String,
      default: "#ffffff",
    },
    order: {
      type: Number,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
