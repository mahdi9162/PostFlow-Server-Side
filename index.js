const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const admin = require('./firebaseAdmin');

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

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
    const userCollection = db.collection('users');
    const tagsCollection = db.collection('tags');

    //----------APIS----------

    // FOR USERS - post api
    app.post('/api/users', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid, email } = req.user;

        // role validation
        const requestedRole = (req.body?.role || '').toLowerCase();
        const allowedRoles = ['creator', 'publisher', 'admin'];

        if (!allowedRoles.includes(requestedRole)) {
          return res.status(400).json({ message: 'Invalid role. Role is required.' });
        }

        const existing = await userCollection.findOne({ firebaseUid: uid });

        if (existing) {
          return res.status(409).json({ message: 'User already exists' });
        }

        const body = {
          firebaseUid: uid,
          email,
          requestedRole,
          status: 'pending',
          role: null,
          createdAt: new Date(),
          approvedAt: null,
          approvedBy: null,
        };

        const result = await userCollection.insertOne(body);
        return res.status(201).json({
          message: 'User request saved (pending approval)',
          insertedId: result.insertedId,
        });
      } catch (error) {
        return res.status(500).json({ message: 'Server error' });
      }
    });

    // FOR USERS - get api only admin
    app.get('/api/access-requests', verifyFirebaseToken, async (req, res) => {
      const { uid } = req.user;

      try {
        const me = await userCollection.findOne({ firebaseUid: uid });

        if (!me || me.status !== 'approved' || me.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden: admin only' });
        }

        const query = { status: 'pending' };

        const result = await userCollection.find(query).sort({ createdAt: -1 }).toArray();

        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // FOR USERS - update api only admin
    app.patch('/api/access-requests/:id/approve', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid } = req.user;
        const { id } = req.params;

        if (!uid) return res.status(401).json({ message: 'Unauthorized' });
        if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid request id' });

        //  admin check
        const me = await userCollection.findOne({ firebaseUid: uid });

        if (!me || me.status !== 'approved' || me.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden: admin only' });
        }

        //  target user
        const query = { _id: new ObjectId(id) };
        const user = await userCollection.findOne(query);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const updatedDoc = {
          $set: {
            status: 'approved',
            role: user.requestedRole,
            approvedAt: new Date(),
            approvedBy: me.email,
          },
        };

        const result = await userCollection.updateOne(query, updatedDoc);

        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // FOR USERS - get my status api for first time signIn user
    app.get('/api/users/me', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid, email } = req.user || {};

        if (!uid) {
          return res.status(401).json({ message: 'Unauthorized: invalid token' });
        }

        const me = await userCollection.findOne({ firebaseUid: uid });

        if (!me) {
          return res.status(404).json({
            message: 'User record not found. Submit access request first.',
            status: 'not_found',
            role: null,
            requestedRole: null,
          });
        }

        return res.status(200).json({
          email: me.email || email || null,
          status: me.status ?? 'pending',
          role: me.role ?? null,
          requestedRole: me.requestedRole ?? null,
          approvedAt: me.approvedAt ?? null,
          approvedBy: me.approvedBy ?? null,
          createdAt: me.createdAt ?? null,
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Server error' });
      }
    });

    //----------------------POSTS----------------------------

    // FOR POSTS - post api
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

    // FOR POSTS - get api
    app.get('/api/posts', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid } = req.user;
        const { account } = req.query;

        const me = await userCollection.findOne({ firebaseUid: uid });

        // approval gate
        if (!me || me.status !== 'approved') {
          return res.status(403).json({ message: 'Access not approved' });
        }

        const query = {};
        if (account) {
          query.account = account.toLowerCase();
        }

        const posts = await postsCollection.find(query).sort({ createdAt: -1 }).limit(10).toArray();

        res.status(200).json(posts);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // post update api
    app.patch('/api/posts/:id', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid } = req.user;
        const { id } = req.params;

        if (!uid) {
          return res.status(401).json({ message: 'Unauthorized: invalid token' });
        }
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid post id' });
        }

        const me = await userCollection.findOne({ firebaseUid: uid });

        if (!me || me.status !== 'approved' || (me.role !== 'admin' && me.role !== 'creator')) {
          return res.status(403).json({ message: 'Access: admin and creator only' });
        }

        const query = { _id: new ObjectId(id) };

        // only allow these fields to update
        const { account, day, caption, cta, source, hashtags, driveLink } = req.body;

        const updatedDoc = {
          $set: {
            account,
            day,
            caption,
            cta,
            source,
            driveLink,
            hashtags,
            updatedAt: new Date(),
            updatedBy: me.email,
          },
        };

        const result = await postsCollection.updateOne(query, updatedDoc);

        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    //update api :  mark as posted/pending
    app.patch('/api/posts/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid post id' });
        }

        if (status !== 'posted' && status !== 'pending') {
          return res.status(400).json({ message: 'Invalid status' });
        }

        const query = { _id: new ObjectId(id) };

        const updatedDoc = {
          $set: { status: status },
          $unset: {},
        };

        if (status === 'posted') {
          updatedDoc.$set.postedAt = new Date();
          delete updatedDoc.$unset;
        } else {
          updatedDoc.$unset = { postedAt: '' };
        }

        const result = await postsCollection.updateOne(query, updatedDoc);

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Post not found' });
        }

        return res.json({ message: 'Marked as posted', modifiedCount: result.modifiedCount });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Tags APIS ------------------------------------------------------
    app.post('/api/tags', verifyFirebaseToken, async (req, res) => {
      try {
        const { uid } = req.user;
        const tags = req.body;

        if (!uid) return res.status(401).json({ message: 'Unauthorized' });
        if (!tags) return res.status(400).json({ message: 'tags required' });

        const admin = await userCollection.findOne({ firebaseUid: uid });

        if (!admin || admin.status !== 'approved' || admin.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden: admin only' });
        }

        tags.account = tags.account.trim().toLowerCase();
        tags.createdAt = new Date();
        const result = await tagsCollection.insertOne(tags);
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

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on ${port}`));
}

module.exports = app;
