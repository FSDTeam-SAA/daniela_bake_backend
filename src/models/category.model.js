import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
    },
    image: {
      type: String, // URL or image filename
      required: [true, "Category image is required"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
