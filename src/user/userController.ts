import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import userModel from "./userModel.ts";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/config.ts";

const createUser = async (req: Request, res: Response, next: NextFunction) => {
  //Validation
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const httpError = createHttpError(400, "All fields are required");
    return next(httpError);
  }

  //Logic - Database call
  try {
    const user =await userModel.findOne({ email });
    if (user) {
      const error = createHttpError(400, "User already exist with this email");
      return next(error);
    }
  } catch (error) {
    return next(createHttpError(500, "Error while getting info on user exist or not"))
  }

 
  let token:string ;
  try {
    let hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userModel.insertOne({
    name,
    email,
    password: hashedPassword,
  });
    token = jwt.sign({ sub: newUser._id }, config.jwtSecret as string, {
    expiresIn: "7d",
  });

  } catch (error) {
    return next(createHttpError(500, "Error while creating user"))
  }

  res.status(201).json({
    msg: "User created sucessfully",
    accessToken: token,
  });
};


const loginUser = async (req: Request, res: Response, next: NextFunction) =>{

}

export { createUser, loginUser };
 