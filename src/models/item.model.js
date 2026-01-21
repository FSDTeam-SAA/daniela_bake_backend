import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  isAllergen: { type: Boolean, default: false },
});

const WEEKDAY_ENUM = ["mon", "tue", "wed", "thu", "fri"];

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
    images: {
      type: [String],
      validate: {
        validator: (val) => Array.isArray(val) && val.length <= 5,
        message: "Images cannot exceed 5",
      },
      default: [],
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
          enum: WEEKDAY_ENUM,
        },
      ],
      default: WEEKDAY_ENUM,
      required: true,
    },
    specialDays: {
      type: [
        {
          type: String,
          enum: WEEKDAY_ENUM,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Keep legacy image field in sync with images array so older clients continue to work
itemSchema.pre("save", function (next) {
  if ((!this.images || this.images.length === 0) && this.image) {
    this.images = [this.image];
  }

  if (Array.isArray(this.images) && this.images.length) {
    this.image = this.images[0];
  }
  next();
});

itemSchema.index({ availableDays: 1 });

export default mongoose.model("Item", itemSchema);
