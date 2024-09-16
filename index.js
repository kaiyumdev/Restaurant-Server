const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5002;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY || "key-yourkeyhere",
});

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
    const paymentCollection = client.db("restuarntDB").collection("payments");

    //jwt related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verityToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        res.status(401).send({ message: "Unauthorized access" });
        return;
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          res.status(401).send({ message: "Unauthorized access" });
          return;
        }
        req.decoded = decoded;
        next();
      });
    };

    //use varifyAdmin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/users", verityToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verityToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: "Forbidden access" });
        return;
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

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
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verityToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "admin" } };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verityToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //menu related routes
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verityToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    app.delete("/menu/:id", verityToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //reviews routes
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //carts related routes
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //payment related routes
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log("amount inside the intent: " + amount);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verityToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      //send user email about payment confirmation
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Excited User <sandbox5ac71cee64804138bf131e2195d96133.mailgun.org>",
          to: ["abdulkaiyumfahim.social@gmail.com"],
          subject: "Thanks for your order confirmation",
          text: "Testing some Mailgun awesomness!",
          html: `<div>
          <h1>Thank you for your order!</h1>
          <h4>Your transactionId: <strong>${payment.transactionId}</strong></h4>
          <p>We would like to get your feedback about our foods</p>
          </div>`,
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.error(err)); // logs any error
      res.send({ paymentResult, deleteResult });
    });

    // admin-stats or analytics
    app.get("/admin-stats", verityToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      //this is not the best way
      // const payments = await paymentCollection.find.toArray();
      // const revenue = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({ users, menuItems, orders, revenue });
    });

    //using aggregate pipeline
    // app.get("/order-stats", async (req, res) => {
    //   const result = await paymentCollection
    //     .aggregate([
    //       // {
    //       //   $unwind: "$menuItemIds",
    //       // },
    //       // {
    //       //   $lookup: {
    //       //     from: "menu",
    //       //     localField: "menuItemIds",
    //       //     foreignField: "_id",
    //       //     as: "menuItems",
    //       //   },
    //       // },
    //       // {
    //       //   $unwind: "$menuItems",
    //       // },
    //       // {
    //       //   $group: {
    //       //     _id: "$menuItems.category",
    //       //     quantity: { $sum: 1 },
    //       //     revenue: { $sum: "$menuItems.price" },
    //       //   },
    //       // },
    //     ])
    //     .toArray();

    //   res.send(result);
    // });

    app.get("/order-stats", verityToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              let: { menuItemId: "$menuItemIds" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$_id", { $toObjectId: "$$menuItemId" }] },
                  },
                },
              ],
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              // Step 5: Format the revenue to two decimal places
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue", // Round the revenue to 2 decimal places
            },
          },
        ])
        .toArray();

      res.send(result);
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
