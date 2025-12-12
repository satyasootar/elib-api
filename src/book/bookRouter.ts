import express from "express";
import { createBook, getsingleBook, listBooks, updateBook,deleteBook } from "./bookController.ts";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import authenticate from "../middlewares/authenticate.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bookRouter = express.Router();

//Routes

const upload = multer({
    dest: path.resolve(__dirname, "../../public/data/uploads"),
    limits: { fileSize: 3e7 }

})

bookRouter.post("/",authenticate, upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: "file", maxCount: 1 }
]), createBook)

bookRouter.patch("/:bookId",authenticate, upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: "file", maxCount: 1 }
]), updateBook)

bookRouter.get("/", listBooks)
bookRouter.get("/:bookId", getsingleBook )
bookRouter.delete("/:bookId",authenticate, deleteBook )

export default bookRouter;
