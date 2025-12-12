import express  from "express";
import cors from 'cors'
import globalErrorHandler from "./middlewares/globalErrorHandler.ts";
import userRouter from "./user/userRouter.ts";
import bookRouter from "./book/bookRouter.ts";

const app = express();
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {

  res.json({
    msg: "Hello",
  });
});

//Routes
app.use("/api/users",userRouter)
app.use("/api/books", bookRouter)


//Global error handler

app.use(globalErrorHandler);
export default app;
