import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({
    "msg":"Hello"
  });
});

export default app;
