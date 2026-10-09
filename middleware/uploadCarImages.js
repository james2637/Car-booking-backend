import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
  },
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.mimetype)) {
      const error = new Error("Car images must be JPEG, PNG, WebP, or AVIF files.");
      error.statusCode = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
});

export default upload;
