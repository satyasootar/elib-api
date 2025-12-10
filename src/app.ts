import express  from "express";

import globalErrorHandler from "./middlewares/globalErrorHandler.ts";
import userRouter from "./user/userRouter.ts";

const app = express();

app.get("/", (req, res) => {

  res.json({
    msg: "Hello",
  });
});


//Routes

app.use("/api/users",userRouter)

//Global error handler

app.use(globalErrorHandler);
export default app;
