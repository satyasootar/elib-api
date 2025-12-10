import app from './src/app.ts'

const startServer =()=>{
    const port = process.env.PORT || 3000

    app.listen(port, ()=>{
        console.log("The server is listning at port:", port);
    })
}

startServer()