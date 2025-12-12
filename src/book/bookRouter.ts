import express from "express";
import { createBook } from "./bookController.ts";

const bookRouter = express.Router();

//Routes

bookRouter.use("/", createBook)

export default bookRouter;
