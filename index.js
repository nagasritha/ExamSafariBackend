require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const jwt= require('jsonwebtoken');
const cors = require("cors");

const app = express();
const port = 3000;
const JWT_SECRET = 'login'
app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const db=new sqlite3.Database('examSafari.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT,
      otp INTEGER,
      timeStamp INTEGER
    )`);
  });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});


app.post('/sendOTP', async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user already exists in the database
    const existingUser = await new Promise((resolve, reject) => {
      db.get(`SELECT email FROM users WHERE email = ?`, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    let otp = Math.floor(100000 + Math.random() * 900000);
    const timeStamp = Date.now();

    if (!existingUser) {
      // User does not exist, insert new row
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO users (email, otp, timeStamp) VALUES (?, ?, ?)`, [email, otp, timeStamp], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      // User exists, update OTP and timestamp
      await new Promise((resolve, reject) => {
        db.run(`UPDATE users SET otp = ?, timeStamp = ? WHERE email = ?`, [otp, timeStamp, email], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    // Send OTP email
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'OTP Verification',
      text: `Your OTP is: ${otp}`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    res.status(200).send('OTP sent successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error sending OTP');
  }
});


app.post('/login', async(req, res) => {
  const { email, otp} = req.body;
  const currentTime = Date.now();
  const expiryTimestamp = currentTime-(1*60*1000);
  const registerdDate = new Date().toISOString(); // Convert to ISO string for insertion into database
  // Verify OTP
  console.log(expiryTimestamp);
  try{
    const existingUser = await new Promise((resolve, reject) => {
      db.get(`SELECT email FROM users WHERE email = ?`, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  
  db.get(`SELECT * FROM users WHERE email = ? AND otp = ? AND timestamp > ?`, [email, otp, expiryTimestamp], (err, row) => {
    if (err) {
      console.log(err);
      res.status(500).send('Error verifying OTP');
    } else if (row) {
      // OTP is valid
      // Generate JWT token
      const token = jwt.sign({ email: email }, JWT_SECRET, { expiresIn: '720h' }); // Token expires in 1 hour
      // Use parameterized query to prevent SQL injection
      if(!existingUser){
        db.run(`INSERT INTO loggedInUsers (email, register_date) VALUES (?, ?)`, [email, registerdDate], (err) => {
          if (err) {
            console.log(err);
            res.status(400).send('Error inserting the data');
          } else {
            res.status(200).json({ token: token });
          }
        });
      }else{
        res.status(200).send({'message':'User Already registerd','token':token});
      }
    } else {
      // OTP is invalid or expired
      res.status(400).send('Invalid or expired OTP');
    }
  });
  }
  catch (error){
    console.log(error);
    res.status(500).send('Error verifying OTP');
  }

});


app.get('/',(request,response)=>{
    db.all(`SELECT * FROM loggedInUSers`,(err,row)=>{
        if(err){
            response.status(400).send('error fetching data');
        }else{
            response.send(row).status(200);
        }
    })
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
