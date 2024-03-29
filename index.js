const { json } = require('body-parser');
const express = require('express');
const cors = require('cors');
const { request } = require('http');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
// const mongops = process.env.MONGODB__PROJECT__PASSWORD;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const uploadMiddleware = multer({ dest: 'uploads/' });
const path = require('path');
const { error } = require('console');
const salt = bcrypt.genSaltSync(10);
const secret = 'bdcwi6eiydbbeu63g4ug22dxe82';


app.use(cookieParser());
app.use(cors({credentials:true, origin:'http://localhost:3001'}))
app.use(express.json());


app.use('/uploads', express.static(__dirname + '/uploads'));


mongoose.set("strictQuery", false);
mongoose.connect(MONGODB__URL);

app.post('/register', async (req,res) => {
  const {username,password} = req.body;
  try {
    const userDoc = await User.create({
      username,
      password:bcrypt.hashSync(password,salt),
    })
    res.json(userDoc);
  } catch (e) {
    console.log(e)
    res.status(400).json(e);
  }

});

app.post('/login', async(req,res)=>{
  const {username,password} = req.body;
  const userDoc = await User.findOne({username});
  const passOk = bcrypt.compareSync(password, userDoc.password)
  if(userDoc && passOk){
    //logged in
    jwt.sign({username, id:userDoc._id}, secret, {}, (err,token) =>{
      if(err) throw err;
      res.cookie('token', token).json({
        id:userDoc._id,
        username,
      });
    });
  }else{
    res.status(400).json("Wrong Credentials");
  }
})

app.get('/profile', (req,res)=>{
  const {token} = req.cookies
  jwt.verify(token, secret, {}, (err, info) =>{
    if(err) throw err;
    res.json(info);
  });
})

app.post('/logout', (req,res) =>{
  res.cookie('token', '').json('ok')
});

app.post('/post', uploadMiddleware.single('file'), async (req,res) =>{
  const {originalname,path} = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length -1];
  const newPath = 'uploads/' + Date.now() + '.' + ext;
  fs.renameSync(path, newPath);

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async(err, info) =>{
    if(err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    })
    res.json(postDoc);
  });
})


app.put('/post', uploadMiddleware.single('file'),async(req,res)=>{
  let newPath = null;
  if(req.file){
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length -1];
    const newPath = 'uploads/' + Date.now() + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async(err, info) =>{
    if(err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if(!isAuthor) {return res.status(400).json('not the author');}
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath? newPath : postDoc.cover,
    });
    res.json(postDoc);
  });
})

app.delete('/post/:id', async(req,res)=>{
    try {
        const deletedItem = await Post.findByIdAndDelete(req.params.id);
        if (!deletedItem) {
          return res.status(404).json({ message: 'Item not found' });
        }
        res.json({ message: 'Item deleted successfully' });
        } catch (err) {
          console.error(err);
          res.status(500).send('Server Error');
        }
})
  

// DELETE a specific item
// router.delete('/post/:id', async (req, res) => {
//   try {
//     const deletedItem = await Post.findByIdAndDelete(req.params.id);
//     if (!deletedItem) {
//       return res.status(404).json({ message: 'Item not found' });
//     }
//     res.json({ message: 'Item deleted successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Server Error');
//   }
// })

app.get('/post', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;

  try {
    const posts = await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/post/:id', async(req,res)=>{
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc)
})

app.listen(3000);
//
