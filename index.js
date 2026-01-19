const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// test route
app.get('/', (req, res) => {
  res.send('PostFlow server running..');
});

// Mongo setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db('postFlow-db');
    const postsCollection = db.collection('posts');

    //----------API----------

    // post api
    app.post('/api/posts', async (req, res) => {
      try {
        const post = req.body;

        if (!post) {
          return res.status(400).json({ message: 'post required' });
        }

        post.account = post.account.trim().toLowerCase();
        post.day = post.day.trim().toLowerCase();
        post.createdAt = new Date();
        post.status = 'pending';
        const result = await postsCollection.insertOne(post);
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // get api
    app.get('/api/posts', async (req, res) => {
      try {
        const limit = 10;
        const result = await postsCollection.find().sort({ createdAt: -1 }).limit(limit).toArray();
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`PostFlow server listening on port ${port}`);
});
