import cloudinary from "../config/cloudinary.js";
import fs from "fs";

const safeUnlink = (path) => {
  if (!path) return;
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch (err) {
    // Swallow ENOENT and other file system noise; the temp file is best-effort cleanup
    if (err.code !== "ENOENT") {
      console.error("Failed to remove temp file:", err.message);
    }
  }
};

export const uploadToCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: "bakehouse",
    });
    safeUnlink(localFilePath); // remove local temp file
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    safeUnlink(localFilePath);
    return null;
  }
};

export const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    const parts = imageUrl.split("/");
    const folderWithFile = parts.slice(parts.indexOf("upload") + 1).join("/");
    const publicId = folderWithFile.replace(/\.[^/.]+$/, ""); // remove extension

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error.message);
  }
};
