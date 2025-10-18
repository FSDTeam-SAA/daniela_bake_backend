import cloudinary from "../config/cloudinary.js";
import fs from "fs";


export const uploadToCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: "bakehouse",
    });
    fs.unlinkSync(localFilePath); // remove local temp file
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    fs.unlinkSync(localFilePath);
    return null;
  }
};


export const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const parts = imageUrl.split("/");
    const fileName = parts.pop(); // filename.jpg
    const folder = parts.slice(parts.indexOf("upload") + 1).join("/");
    const publicId = folder.replace(/\.[^/.]+$/, ""); // remove extension

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error.message);
  }
};
