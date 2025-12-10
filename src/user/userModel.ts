import mongoose from "mongoose";
import type { user } from "./userTypes.ts";

const userSchema = new mongoose.Schema<user>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const userModel = mongoose.model<user>("Users", userSchema);

export default userModel