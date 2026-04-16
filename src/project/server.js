const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/complaints', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Routes
const userRoutes = require('./routes/user');
const complaintRoutes = require('./routes/complaint');

app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);

app.listen(5000, () => console.log('Server running on port 5000'));
