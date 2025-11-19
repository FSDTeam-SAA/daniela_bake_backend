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
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
