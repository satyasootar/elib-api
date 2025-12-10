import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";

const createUser = async (req: Request, res: Response, next: NextFunction) => {
  //Validation
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const httpError = createHttpError(400, "All fields are required");
    return next(httpError);
  }

  //Logic

  //response
  res.send("User created");
};

export default createUser;
