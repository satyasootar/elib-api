import type { NextFunction, Request, Response } from "express";
import cloudinary from "../config/cloudinary.ts";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import createHttpError from "http-errors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const createBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [filename: string]: Express.Multer.File[] };
    const coverImageMimeType = files.coverImage[0]?.mimetype.split("/").at(-1);

    const filename = files.coverImage[0].filename;

    const filePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      filename
    );

    const uploadResults = await cloudinary.uploader.upload(filePath, {
      filename_override: filename,
      folder: "book-covers",
      format: coverImageMimeType,
    });

    //upload file

    const bookFileName = files.file[0].filename;
    const bookFilePath = path.resolve(
      __dirname,
      "../../public/data/uploads",
      bookFileName
    );

    const bookFileUploadResult = await cloudinary.uploader.upload(
      bookFilePath,
      {
        resource_type: "raw",
        filename_override: bookFileName,
        folder: "book-files",
        format: "pdf",
      }
    );

    console.log(bookFileUploadResult);
    console.log(uploadResults);


    




    res.json({});
  } catch (error) {
    return next(createHttpError(501, "Error while uploading the files"));
  }
};

export { createBook };
