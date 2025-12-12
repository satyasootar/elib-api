import type { NextFunction, Request, Response } from "express";
import cloudinary from "../config/cloudinary.ts";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import createHttpError from "http-errors";
import bookModel from "./bookModel.ts";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a book:
 *  - validate request
 *  - upload cover image and book file to Cloudinary
 *  - store book metadata in DB
 *  - remove temporary files
 *
 * Proper, granular try/catch blocks are used so we can return meaningful errors
 * and ensure temporary files are removed where possible.
 */
const createBook = async (req: Request, res: Response, next: NextFunction) => {
  // Validate body + files early
  const { title, genre } = req.body;
  const files = req.files as { [filename: string]: Express.Multer.File[] } | undefined;

  if (!title || !genre) {
    return next(createHttpError(400, "Missing required fields: title or genre"));
  }

  if (!files || !files.coverImage || !files.file) {
    return next(createHttpError(400, "Missing uploaded files: coverImage and/or file"));
  }

  const coverFile = files.coverImage?.[0];
  const bookFile = files.file?.[0];

  if (!coverFile || !bookFile) {
    return next(createHttpError(400, "Uploaded files are invalid"));
  }

  // Resolve temp paths
  const coverFilename = coverFile.filename;
  const bookFilename = bookFile.filename;

  const coverFilePath = path.resolve(__dirname, "../../public/data/uploads", coverFilename);
  const bookFilePath = path.resolve(__dirname, "../../public/data/uploads", bookFilename);

  // Helper to attempt deleting temp files (best-effort)
  const cleanupTempFiles = async () => {
    try {
      await fs.promises.unlink(coverFilePath).catch(() => {});
    } catch {
      /* ignore */
    }
    try {
      await fs.promises.unlink(bookFilePath).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  // Determine cover image format (last part after '/')
  const coverImageMimeType = coverFile.mimetype?.split("/").at(-1) ?? undefined;

  let uploadedCoverResult: { secure_url?: string } | undefined;
  let uploadedBookResult: { secure_url?: string } | undefined;
  let insertedBook: any;

  try {
    // Upload cover image
    try {
      uploadedCoverResult = await cloudinary.uploader.upload(coverFilePath, {
        filename_override: coverFilename,
        folder: "book-covers",
        format: coverImageMimeType,
      });
    } catch (err) {
      // Attempt cleanup then forward a helpful error
      await cleanupTempFiles();
      console.error("Cloudinary cover upload error:", err);
      return next(createHttpError(502, "Failed to upload cover image to Cloudinary"));
    }

    // Upload book file (raw resource_type)
    try {
      uploadedBookResult = await cloudinary.uploader.upload(bookFilePath, {
        resource_type: "raw",
        filename_override: bookFilename,
        folder: "book-files",
        format: "pdf",
      });
    } catch (err) {
      // If book upload fails, try to remove cover already uploaded? (optional)
      // cleanup local temp files and return error
      await cleanupTempFiles();
      console.error("Cloudinary book upload error:", err);
      return next(createHttpError(502, "Failed to upload book file to Cloudinary"));
    }

    // Ensure we have secure URLs
    if (!uploadedCoverResult?.secure_url || !uploadedBookResult?.secure_url) {
      await cleanupTempFiles();
      console.error("Cloudinary did not return secure_url for uploads");
      return next(createHttpError(502, "Cloudinary upload did not return a secure URL"));
    }

    // Insert to database
    try {
      const doc = {
        title,
        author: "693adf9bd0f376cedbc61efd", // keep as-is or replace with real author
        genre,
        coverImage: uploadedCoverResult.secure_url,
        file: uploadedBookResult.secure_url,
      };

      insertedBook = await bookModel.insertOne(doc);
      // insertedBook may be the InsertOneResult; adjust based on your driver
      if (!insertedBook?.acknowledged && !insertedBook?._id) {
        // Defensive: if insert did not produce an id, treat as error
        console.error("Database insert returned unexpected result:", insertedBook);
        await cleanupTempFiles();
        return next(createHttpError(500, "Failed to save book to database"));
      }
    } catch (err) {
      await cleanupTempFiles();
      console.error("Database insert error:", err);
      return next(createHttpError(500, "Error while saving book to database"));
    }

    // Remove temporary files (best-effort)
    try {
      await fs.promises.unlink(coverFilePath).catch(() => {});
      await fs.promises.unlink(bookFilePath).catch(() => {});
    } catch (err) {
      // Log but don't fail the request if cleanup failed
      console.warn("Failed to delete temporary upload files:", err);
    }

    // Respond with created resource id (normalize to _id if present)
    const createdId = insertedBook?._id ?? insertedBook?.insertedId ?? null;

    return res.status(201).json({
      id: createdId,
      message: "Book uploaded successfully",
    });
  } catch (err) {
    // Catch-all for unexpected errors
    console.error("Unexpected error in createBook:", err);
    // Attempt cleanup of temporary files before returning
    await cleanupTempFiles();
    return next(createHttpError(500, "Unexpected error while uploading the files"));
  }
};

export { createBook };
