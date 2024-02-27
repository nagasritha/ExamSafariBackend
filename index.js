require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const jwt= require('jsonwebtoken');
const cors = require("cors");
const {v4 : uuid} = require("uuid")
const app = express();
const port = 3000;
const multer=require('multer');
app.use(cors());

app.use('/uploads', express.static('uploads'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const db=new sqlite3.Database('examSafari.db');
db.serialize(() => {
 
  db.run(`CREATE TABLE profileDetails(
    id VARCHAR PRIMARY KEY NOT NULL,
    user_id VARCHAR,
    image_url VARCHAR,
    name VARCHAR,
    education_status VARCHAR,
    about VARCHAR,
    phone_number INTEGER,
    address VARCHAR,
    country VARCHAR,
    state VARCHAR,
    email VARCHAR,
    insta_profile VARCHAR,
    twitter_profile VARCHAR,
    facebook_profile VARCHAR,
    linkedin_profile VARCHAR,
    FOREIGN KEY (user_id) REFERENCES loggedInUsers(id) );`, (err) => {
      if (err) {
          console.log("table already created");
      } else {
          console.log("table created");
      }
  });

    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) {
          console.error('Error enabling foreign key constraints', err);
      } else {
          console.log('Foreign key constraints enabled.');
      }
  });

  });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'uploads/') // Store uploaded files in the 'uploads' directory
  },
  filename: function (req, file, cb) {
      cb(null, file.originalname)
  }
});

const upload = multer({ storage: storage });

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
    res.status(200).send({'message':'OTP sent successfully'});
  } catch (error) {
    console.error(error);
    res.status(500).send({'message':'Error sending OTP'});
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
      db.get(`SELECT email FROM loggedInUsers WHERE email = ?`, [email], (err, row) => {
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
      res.status(500).send({'message':'Error verifying OTP'});
    } else if (row) {
      // OTP is valid
      // Generate JWT token
      const payload={
        email:email
      }
      const token = jwt.sign(payload,"jwt_secret");
      console.log(token);
      jwt.verify(token,'jwt_secret',async(error,response)=>{
        if(error){
          console.log("error")
        }else{
          console.log(response.email)
        }
      });
      // Use parameterized query to prevent SQL injection
      if(!existingUser){
        const randomId=uuid();
        db.run(`INSERT INTO loggedInUsers (id, email, register_date) VALUES (?, ?, ?)`, [randomId, email, registerdDate], (err) => {
          if (err) {
            console.log(err);
            res.status(400).send({'message':'Error inserting the data'});
          } else {
            res.status(200).json({ 'message':'Logged in successfully',token: token });
          }
        });
      }else{
        res.status(200).send({'message':'User Already registerd','token':token});
      }
    } else {
      // OTP is invalid or expired
      res.status(400).send({'message':'Invalid or expired OTP'});
    }
  });
  }
  catch (error){
    console.log(error);
    res.status(500).send({'message':'Error verifying OTP'});
  }

});


app.get('/',(request,response)=>{
    db.all(`SELECT * FROM loggedInUsers`,(err,row)=>{
        if(err){
            response.status(400).send({'message':'error fetching data'});
        }else{
            response.send(row).status(200);
        }
    })
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send({'message':"JWT Token is not provided"});
  } else {
    jwt.verify(jwtToken, "jwt_secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send({'message':"Invalid JWT Token"});
      } else {
        request.email=payload.email;
        const userData = await new Promise((resolve, reject) => {
          db.get(`SELECT id FROM loggedInusers WHERE email=?;`, [payload.email], (err, row) => {
            if (err) {
              reject("Error: error fetching the data");
            } else {
              resolve(row);
            }
          });
        });
        request.id=userData.id;
        next();
      }
    });
  }
};

app.post('/submit-form', authenticateToken, upload.single('admitCard'), async (req, res) => {
  const { name, whatsappNumber, address, examCity, examCenter } = req.body;
  const email = req.email;
  console.log(email);
  try {
    // Fetch user data from the database

    const id = uuid(); // Generate a unique ID for the form submission
    const user_id = req.id; // Accessing the user ID property
    // Insert the form data into the database
    const imageUrl=`https://examsafaribackend.onrender.com/uploads/${req.file.filename}`;
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO enquire (id, user_id, name, whatsapp_number, address, exam_city, exam_center, admit_card_path)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [id, user_id, name, whatsappNumber, address, examCity, examCenter, imageUrl],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });

    res.status(200).send({ 'message': 'Form submitted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ 'message': 'Error submitting form' });
  }
});

app.get('/formDetails' ,authenticateToken, async(req,response)=>{
  dataPromise = new Promise((resolve, reject) => {
  db.all(`SELECT * FROM  enquire;`, (err, row) => {
    if (err) {
      reject("Error: error fetching the data");
    } else {
      resolve(row);
    }
  });
});

try {
  const data = await dataPromise; // Wait for the promise to resolve
  console.log(data); // This will log the fetched data
  response.send({'EnquireDetails':data}).status(200);
} catch (error) {
  console.error(error); // Handle errors if any
  response.send({'message':"error fetching details"}).status(400);
}

})

app.post('/submit-profile', authenticateToken, upload.single('profileUrl'), async (req, res) => {
  const { name, about,educationStatus,phoneNumber,address,country,state,instaProfile,twitterProfile,facebookProfile,linkedinProfile} = req.body;
  const email = req.email;
  console.log(email);
  /*id VARCHAR PRIMARY KEY NOT NULL,
    user_id VARCHAR,
    image_url VARCHAR,
    name VARCHAR,
    education_status VARCHAR,
    about VARCHAR,
    phone_number INTEGER,
    address VARCHAR,
    country VARCHAR,
    email VARCHAR,
    insta_profile VARCHAR,
    twitter_profile VARCHAR,
    facebook_profile VARCHAR,
    linkedin_profile VARCHAR,*/
  try {
    // Fetch user data from the database
    const existingUser = await new Promise((resolve, reject) => {
      db.get(`SELECT email FROM profileDetails WHERE email = ?`, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
    const id = uuid(); // Generate a unique ID for the form submission
    const user_id = req.id; // Accessing the user ID property
    // Insert the form data into the database
    const imageUrl=`https://examsafaribackend.onrender.com/uploads/${req.file.filename}`;
    if(!existingUser){
    await new Promise((resolve, reject) => {
      db.run(`INSERT INTO profileDetails (id, user_id, name, about, email, image_url, education_status, country, state, phone_number, address, insta_profile, twitter_profile, facebook_profile, linkedin_profile)
              VALUES (?, ?, ?, ?, ?,?,?,?,?,?,?,?,?,?,?);`,
        [id, user_id, name,about,email,imageUrl,educationStatus,country,state,phoneNumber,address,instaProfile,twitterProfile,facebookProfile,linkedinProfile],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });
    res.status(200).send({ 'message': 'Form submitted successfully' });
  }else{
    await new Promise((resolve, reject) => {
      db.run(`UPDATE profileDetails SET name = ?, image_url = ?, about = ?, education_status = ?, country = ?, state = ?, address = ?, insta_profile = ?, facebook_profile = ?, twitter_profile = ?, linkedin_profile = ?, phone_number = ? WHERE email = ?`, 
                                                  [name, imageUrl, about, educationStatus, country, state, address, instaProfile,facebookProfile,twitterProfile,linkedinProfile, phoneNumber, email], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    res.send({"message": "profile Updated Successfully"}).status(200);
  }

   
  } catch (error) {
    console.error(error);
    res.status(500).send({ 'message': 'Error submitting form' });
  }
});

app.get('/getProfileData' ,authenticateToken, async(req,response)=>{
  const dataPromise = new Promise((resolve, reject) => {
  db.all(`SELECT * FROM  profileDetails;`, (err, row) => {
    if (err) {
      reject("Error: error fetching the data");
    } else {
      resolve(row);
    }
  });
});

try {
  const data = await dataPromise; // Wait for the promise to resolve
  console.log(data); // This will log the fetched data
  response.send({'UserProfiles':data}).status(200);
} catch (error) {
  console.error(error); // Handle errors if any
  response.send({'message':"error fetching details"}).status(400);
}

});

app.get('/getEachProfileData' ,authenticateToken, async(req,response)=>{
  const dataPromise = new Promise((resolve, reject) => {
  db.get(`SELECT * FROM  profileDetails WHERE email = ?;`,[req.email], (err, row) => {
    if (err) {
      reject("Error: error fetching the data");
    } else {
      resolve(row);
    }
  });
});

try {
  const data = await dataPromise; // Wait for the promise to resolve
  console.log(data); // This will log the fetched data
  response.send({'UserProfiles':data}).status(200);
} catch (error) {
  console.error(error); // Handle errors if any
  response.send({'message':"error fetching details"}).status(400);
}

})



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});