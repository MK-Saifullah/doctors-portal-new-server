const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();

//Middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u6oqlug.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const database = client.db("doctorsPortal").collection("bookingData")
        const bookingsCollection = client.db("doctorsPortal").collection("appointmentsData")
        /**
         * API Naming conventions
         * app.get('/bookingData)
         * app.get('/bookingData/:id)
         * app.post('/bookingData)
         * app.patch('/bookingData/:id)
         * app.delete('/bookingData/:id)
         */
        app.get('/bookingData', async (req, res) => {
            const query = {};
            const cursor = await database.find(query).toArray()
            console.log(cursor)
            res.send(cursor)
        })

        app.post('/appointmentsData', async (req, res) => {
            const user = req.body;
            const result = await bookingsCollection.insertOne(user);
            console.log(result)
            res.send(result)
        })
      
    }
    finally {

    }
}
run().catch(console.dir)
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });


app.get('/', async (req, res) => {
    res.send('Doctors portal server running')
});

app.listen(port, () => {
    console.log(`Doctors portal special edition server running at ${port}`)
})