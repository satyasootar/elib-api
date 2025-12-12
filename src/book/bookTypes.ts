import type mongoose from "mongoose";

export interface Book {
  _id: string;
  title: string;
  author:  mongoose.Types.ObjectId;;
  genre: string;
  coverImage: string;
  file: string;
  createdAt:Date;
  updatedAt:Date;
}
