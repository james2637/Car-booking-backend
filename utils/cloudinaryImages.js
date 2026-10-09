import { v2 as cloudinary } from "cloudinary";

const uploadImage = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "car-booking/cars", resource_type: "image" },
      (error, result) => {
        if (error) {
          const uploadError = new Error("Cloudinary image upload failed.");
          uploadError.statusCode = 502;
          uploadError.cause = error;
          reject(uploadError);
          return;
        }

        if (!result?.secure_url || !result.public_id) {
          reject(new Error("Cloudinary did not return the uploaded image details."));
          return;
        }

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    stream.end(file.buffer);
  });

export const uploadCarImages = async (files) => {
  const results = await Promise.allSettled(files.map(uploadImage));
  const uploadedImages = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failedUpload = results.find((result) => result.status === "rejected");

  if (failedUpload) {
    try {
      await deleteCarImages(uploadedImages);
    } catch (error) {
      console.error("Failed to clean up partially uploaded car images:", error);
    }
    throw failedUpload.reason;
  }

  return uploadedImages;
};

export const deleteCarImages = async (images) => {
  const results = await Promise.allSettled(
    images.map(async (image) => {
      const result = await cloudinary.uploader.destroy(image.publicId, { resource_type: "image" });
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary could not delete image ${image.publicId}.`);
      }
    }),
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    throw new Error(`Failed to delete ${failures.length} car image(s) from Cloudinary.`);
  }
};
