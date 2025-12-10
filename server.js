"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var app_1 = require("./src/app");
var startServer = function () {
    var port = process.env.PORT || 3000;
    app_1.default.listen(port, function () {
        console.log("The server is listning at port:", port);
    });
};
startServer();
