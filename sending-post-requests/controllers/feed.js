const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator/check');

const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  
try {
  const totalItems = await Post.find().countDocuments();
  const posts = await Post.find().populate('creator')
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

  res.status(200).json({
    message: 'post retrieved successfully', 
    posts: posts, 
    totalItems: totalItems
  });  
} catch(err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err)
  }
};

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("validation failed, entered data is incorrect");
    error.statusCode = 422;
    throw error;
  }
  if (!req.file) {
    const error = new Error('no image provided')
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path;
  const title = req.body.title;
  const content = req.body.content;
  let creator;
  const post = new Post({
    title: title, 
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });

  post.save()
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then(result => {
        res.status(201).json({
          message: 'Post created successfully!',
          post: post,
          creator: { _id: creator._id, name: creator.name }
        });
    })
    .catch(err => {
      if (!error.statusCode) {  
        err.statusCode = 500;
      }
      next(err);
    })
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('could not find post')
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({message: 'Post fetched successfully', post: post});
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("validation failed, entered data is incorrect");
    error.statusCode = 422;
    throw error;
  }
  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path;
  }
  if (!imageUrl) {
    const error = new Error('no file picked');
    error.statusCode = 422;
    throw error;
  }
  Post.findById(postId)
      .then(post => {
          if (!post) {
            const error = new Error('could not find post')
            error.statusCode = 404;
            throw error;
          }
          if (post.creator.toString() !== req.userId) {
            const error = new Error('not authorized user')
            error.statusCode = 403;
            throw error;
          }
          if (imageUrl !== post.imageUrl) {
            clearImage(post.imageUrl);
          } 
          post.title = title;
          post.imageUrl = imageUrl;
          post.content = content;
          return post.save();
        })
        .then(result => {
          res.status(200).json({message: 'post updated successfully', post: result});
        })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      })
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('could not find post')
        error.statusCode = 404;
        throw error;
      }
      if (post.creator.toString() !== req.userId) {
        const error = new Error('not authorized user')
        error.statusCode = 403;
        throw error;
      }
      //check logged in user
      clearImage(post.imageUrl);
      return Post.findByIdAndRemove(postId);
    })
    .then(result => {
      return User.findById(req.userId)
    })
    .then(user => {
      user.posts.pull(postId);
      return user.save();
    })
    .then(result => {
      res.status(200).json({ message: 'Deleted Post' });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log(err));
}