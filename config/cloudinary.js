import { v2 as cloudinary } from "cloudinary";

const connectCloudinary = () => {
    // if (
    //     !process.env.CLOUDINARY_NAME ||
    //     !process.env.CLOUDINARY_API_KEY ||
    //     !process.env.CLOUDINARY_SECRET_KEY
    // ) {
    //     throw new Error("Cloudinary environment variables are not configured.");
    // }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_SECRET_KEY,
    });
};

export default connectCloudinary;