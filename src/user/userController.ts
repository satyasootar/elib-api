import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import userModel from "./userModel.ts";
import bcrypt from 'bcrypt'


const createUser = async (req: Request, res: Response, next: NextFunction) => {
  //Validation
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const httpError = createHttpError(400, "All fields are required");
    return next(httpError);
  }

  //Logic - DAtabase call
  const user = await userModel.insertOne(req.body);
  if (user) {
    const error = createHttpError(400, "User already exist with this email");
    return next(error)
  }
  ///Store the user in the database
  // Hash the password
  let hashedPassword = await bcrypt.hash(password, 10)



  //response
  res.send("User created");
};

export default createUser;
