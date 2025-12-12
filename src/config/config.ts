import { config as conf } from "dotenv";
conf();

const _config = {
  port: process.env.PORT,
  databaseURL: process.env.MONGO_CONNECTION_STRING,
  env: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryCloud : process.env.CLOUDINARY_CLOUD_NAME
};

export const config = Object.freeze(_config);
