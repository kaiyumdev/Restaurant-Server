const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5002;

app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.40hja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Define your database and collection names here
    const userCollection = client.db("restuarntDB").collection("users");
    const menuCollection = client.db("restuarntDB").collection("menu");
    const reviewCollection = client.db("restuarntDB").collection("reviews");
    const cartCollection = client.db("restuarntDB").collection("carts");

    //usrs related api methods
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const userExists = await userCollection.findOne(query);
      if (userExists) {
        res.send("User already exists");
        return;
      }
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "admin" } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      console.log(result);
      res.json(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.json(result);
    });

    //menu routes
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.json(result);
    });

    //reviews routes
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.json(result);
    });

    //carts related routes
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.json(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.json(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.json(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Restaurant Server running at: ${port}`);
});
