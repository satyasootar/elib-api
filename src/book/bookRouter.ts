import express from "express";
import { createBook } from "./bookController.ts";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bookRouter = express.Router();

//Routes

const upload = multer({
    dest: path.resolve(__dirname, "../../public/data/uploads"),
    limits: { fileSize: 3e7 }

})

bookRouter.post("/", upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: "file", maxCount: 1 }
]), createBook)

export default bookRouter;
