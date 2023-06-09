const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// const ObjectID = require('mongodb').ObjectID;

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
        return res.status(401).send({message: 'Unauthorized access, Sorry'})
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
        const doctorsCollection = client.db("doctorsPortal").collection("doctors")
        const paymentsCollection = client.db("doctorsPortal").collection("payments")
        
        //Middleware for make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail};
            const user = await usersCollection.findOne(query)

            if(user?.role !=='admin') {
                return res.status(403).send({ message: 'Forbidden access'})
            }
            next();
        }
        /**
         * API Naming conventions
         * app.get('/bookingData)
         * app.get('/bookingData/:id)
         * app.post('/bookingData)
         * app.patch('/bookingData/:id)
         * app.delete('/bookingData/:id)
         */

        //STRIPE PAYMENT
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'USD',
                amount : amount,
                "payment_method_types": ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId;
            const filter = {_id : new ObjectId(id)}
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId:payment.transactionId,
                }
            }
            const updateResult = await bookingsCollection.updateOne(filter, updatedDoc)
            // res.send(updateResult)
            res.send(result);
        })
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

        app.get('/payment/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id)}
            const result = await bookingsCollection.findOne(query)
            res.send(result)
        })
    // Temporarily to update price field on database collections
        app.get('/addPrice', async (req, res) => {
            const filter = {}
            const options = { upsert: true}
            const updateDoc = {
                $set: {
                    price: 99
                }
            }
            const result = await database.updateMany(filter, updateDoc, options)
            res.send(result)
        })

        // app.get('/v2/bookingData', async (req, res) => {
        //     const date = req.query.date;
        //     const options = await appointmentOptionCollection.aggregate([
        //         {
        //             $lookup: {
        //                 from: 'bookings',
        //                 localField: 'name',
        //                 foreignField: 'treatment',
        //                 pipeline: [
        //                     {
        //                         $match: {
        //                             $expr: {
        //                                 $eq: ['$appointmentDate', date]
        //                             }
        //                         }
        //                     }
        //                 ],
        //                 as: 'booked'
        //             }
        //         },
        //         {
        //             $project: {
        //                 name: 1,
        //                 slots: 1,
        //                 booked: {
        //                     $map: {
        //                         input: '$booked',
        //                         as: 'book',
        //                         in: '$$book.slot'
        //                     }
        //                 }
        //             }
        //         },
        //         {
        //             $project: {
        //                 name: 1,
        //                 slots: {
        //                     $setDifference: ['$slots', '$booked']
        //                 }
        //             }
        //         }
        //     ]).toArray();
        //     res.send(options);
        // })



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
            if(alreadyBooked.length) {
                const message = `You have already booked on ${booking.appointmentDate}`;
                return res.send({acknowledged: false, message})
            }

            const result = await bookingsCollection.insertOne(booking);
            // console.log(result)
            res.send(result)
        })

        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {};
            const result = await database.find(query).project({name: 1}).toArray();
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



    //    app.get('/users/admin/:email', async (req, res) => {
    //     const email = req.params.email;
    //     const query = { email }
    //     const user = await usersCollection.findOne(query);
    //     res.send({ isAdmin: user?.role === 'admin' });
    // })

    app.get('/users/admin/:email', async (req, res) => {
     const email = req.params.email;
     const query = {email};
    const user = await usersCollection.findOne(query)
     res.send({isAdmin: user?.role === 'admin'})
 })

    //Check if the user is Admin or not
       app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
        // const decodedEmail = req.decoded.email;
        // const query = { email: decodedEmail };
        // const user = await usersCollection.findOne(query);

        // if (user?.role !== 'admin') {
        //    return res.status(403).send({ message: 'forbidden' });
        // }

        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }
        const options = { upsert: true };
        const updatedDoc = {
            $set: {
                role: 'admin'
            }
        }
        const result = await usersCollection.updateOne(filter, updatedDoc, options);
        res.send(result);
    })


    //Image post
    app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
        const doctor = req.body;
        const result = await doctorsCollection.insertOne(doctor)
        res.send(result)
    })

    app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
        const query = {};
        const doctors = await doctorsCollection.find(query).toArray();
        // console.log(doctors)
        res.send(doctors)
    })

    app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await doctorsCollection.deleteOne(query);
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