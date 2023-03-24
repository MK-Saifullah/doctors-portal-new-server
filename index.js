const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const jwt = require("jsonwebtoken")

const app = express();

//Middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u6oqlug.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//Middleware JWT
function verifyJWT(req, res, next) {
    console.log('token inside JWT', req.headers.authorization)
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.send(401).send({message: 'Unauthorized access'})
    }  
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded) {
        if (err) {
            return res.status(403).send({message: 'Invalid authorization access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const database = client.db("doctorsPortal").collection("bookingData")
        const bookingsCollection = client.db("doctorsPortal").collection("appointmentsData")
        const usersCollection = client.db("doctorsPortal").collection("users")
        /**
         * API Naming conventions
         * app.get('/bookingData)
         * app.get('/bookingData/:id)
         * app.post('/bookingData)
         * app.patch('/bookingData/:id)
         * app.delete('/bookingData/:id)
         */

        //use aggregate to query multiple collections and then merge
        app.get('/bookingData', async (req, res) => {
            date = req.query.date;
            // console.log(date)
            const query = {};
            const cursor = await database.find(query).toArray()
            // console.log(cursor)

            //get the bookings of the provided date
            const bookingQuery = {appointmentDate: date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            //code carefully
            cursor.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
                console.log( date, option.name, remainingSlots.length)
            })
            res.send(cursor)
        })

        //To Get DATA
        app.get('/appointmentsData', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail) {
                return res.status(403).send({message: 'forbidden access'})
            }
            // console.log('token', req.headers.authorization)
            const query = {email: email};
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings) 
        })

        //TO SEND DATA
        app.post('/appointmentsData', async (req, res) => {
            const booking = req.body;
            // console.log(booking)
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment,
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            // console.log(alreadyBooked)
            if(alreadyBooked.length > 0) {
                const message = `You have already booked on ${booking.appointmentDate}`;
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(booking);
            console.log(result)
            res.send(result)
        })

        //JWT token
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            if(user) {
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN, { expiresIn: '2h' })
                return res.send({accessToken: token});
            }
            // console.log(user);
            res.status(403).send({accessToken: ''})
        })
       //User collection creation
       app.post('/users', async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result)
       })

       app.get('/users', async ( req, res) => {
        const query = {}
        const users = await usersCollection.find(query).toArray()
        res.send(users)

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