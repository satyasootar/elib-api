import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import cloudinary from "../config/cloudinary.ts";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
        author: (req as unknown as { userId?: string }).userId ?? "693adf9bd0f376cedbc61efd",
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

/**
 * Update a book:
 *  - validate request + authentication
 *  - optionally upload new cover and/or book file
 *  - update DB record
 *  - cleanup temp files
 */
const updateBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, genre } = req.body;
    const bookId = req.params.bookId;

    if (!bookId) {
      return next(createHttpError(400, "bookId is required in params"));
    }

    const files = (req.files || {}) as { [filename: string]: Express.Multer.File[] } | undefined;

    // 1. Check if the book exists
    let book;
    try {
      book = await bookModel.findOne({ _id: bookId });
    } catch (err) {
      console.error("DB findOne error:", err);
      return next(createHttpError(500, "Failed to fetch book from database"));
    }

    if (!book) {
      return next(createHttpError(404, "Book not found"));
    }

    // 2. Check if user is authenticated & authorized
    const userId = (req as unknown as { userId?: string }).userId;
    if (!userId) {
      return next(createHttpError(401, "Unauthenticated"));
    }

    // Normalize author to string for comparison
    const bookAuthorId = typeof book.author === "string" ? book.author : (book.author?._id ?? book.author)?.toString?.();

    if (bookAuthorId !== userId) {
      return next(createHttpError(403, "Unauthorized access"));
    }

    // Helpers for file paths and cleanup
    const uploadedTempPaths: string[] = [];
    const tryUnlink = async (p?: string) => {
      if (!p) return;
      try {
        await fs.promises.unlink(p).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    // 3. Optionally upload new cover image
    let coverImageUrl = "";
    if (files?.coverImage && files.coverImage[0]) {
      const fileName = files.coverImage[0].filename;
      const coverMimeType = files.coverImage[0].mimetype.split("/").at(-1);
      const filePath = path.resolve(__dirname, "../../public/data/uploads/", fileName);

      // remember to cleanup this temp file later
      uploadedTempPaths.push(filePath);

      try {
        const uploadCoverImage = await cloudinary.uploader.upload(filePath, {
          filename_override: fileName,
          folder: "book-covers",
          format: coverMimeType,
        });
        coverImageUrl = uploadCoverImage.secure_url;
      } catch (err) {
        console.error("Cover upload error:", err);
        // cleanup temp files we created for this request
        await Promise.all(uploadedTempPaths.map(p => tryUnlink(p)));
        return next(createHttpError(502, "Failed to upload cover image"));
      }
    }

    // 4. Optionally upload new book file
    let bookFileUrl = "";
    if (files?.file && files.file[0]) {
      const bookfile = files.file[0].filename;
      const bookFilePath = path.resolve(__dirname, "../../public/data/uploads", bookfile);
      const bookMineType = "pdf";

      // remember to cleanup this temp file later
      uploadedTempPaths.push(bookFilePath);

      try {
        const uploadBookFile = await cloudinary.uploader.upload(bookFilePath, {
          filename_override: bookfile,
          folder: "book-files",
          resource_type: "raw",
          format: bookMineType,
        });
        bookFileUrl = uploadBookFile.secure_url;
      } catch (err) {
        console.error("Book file upload error:", err);
        await Promise.all(uploadedTempPaths.map(p => tryUnlink(p)));
        return next(createHttpError(502, "Failed to upload book file"));
      }
    }

    // 5. Update in the database
    let updatedDoc;
    try {
      const updatePayload: any = {
        title: title ?? book.title,
        genre: genre ?? book.genre,
        coverImage: coverImageUrl ? coverImageUrl : book.coverImage,
        file: bookFileUrl ? bookFileUrl : book.file,
      };

      updatedDoc = await bookModel.findOneAndUpdate(
        { _id: bookId },
        updatePayload
      );

      if (!updatedDoc) {
        // Depending on driver, findOneAndUpdate may return null or the previous doc.
        // Adjust this check to your driver behavior.
        console.error("Book update returned falsy result:", updatedDoc);
        await Promise.all(uploadedTempPaths.map(p => tryUnlink(p)));
        return next(createHttpError(500, "Failed to update book"));
      }
    } catch (err) {
      console.error("Database update error:", err);
      await Promise.all(uploadedTempPaths.map(p => tryUnlink(p)));
      return next(createHttpError(500, "Error while updating book in database"));
    }

    // Cleanup temporary files (best-effort)
    try {
      await Promise.all(uploadedTempPaths.map(p => tryUnlink(p)));
    } catch (err) {
      console.warn("Failed to delete temporary files after update:", err);
    }

    // Respond with updated id (normalize shape depending on your DB driver)
    const returnedId = updatedDoc?._id ?? updatedDoc?.value?._id ?? bookId;

    return res.status(200).json({
      message: "File updated successfully",
      id: returnedId,
    });
  } catch (err) {
    console.error("Unexpected error in updateBook:", err);
    return next(createHttpError(500, "Unexpected error while updating the book"));
  }
};


const listBooks = async (req: Request, res: Response, next: NextFunction) => {

  try {
    let books = await bookModel.find();

    res.status(201).json({
      message:"Books fetch sucessfully",
      books
    }) 
  } catch (error) {
    return next(createHttpError(500, "Failed to fetch books"))
  }
}


const getsingleBook = async (req: Request, res: Response, next: NextFunction) =>{
  const bookId = req.params.bookId

  if(!bookId){
    return next(createHttpError(401, "Book id is invalid/not found"))
  }
  try {
    let book = await bookModel.findOne({_id:bookId})
    if(!book){
      return next(createHttpError(401, "Book does not exist"))
    }
    res.json({
      message:"Book fetched sucessfullly",
      book
    })
  } catch (error) {
    return next(createHttpError(401, "Error while fetching the book"))
  }
}

export { createBook, updateBook, listBooks, getsingleBook };